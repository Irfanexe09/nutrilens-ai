import os
import json
import logging
import asyncio
import time
import random
import re
from typing import List, Dict, Any, Optional, Tuple

from google import genai
from google.genai import types
try:
    from google.genai.errors import APIError, ClientError, ServerError
except ImportError:
    APIError = ClientError = ServerError = Exception

from app.core.config import settings
from app.ai.base import (
    AIProvider,
    AIAnalysisResult,
    DetectedItemCandidate,
    EstimatedPortion,
    AIRecommendation,
    AIProviderError,
    AIProviderConfigError,
    AIProviderUnavailableError,
    AIProviderTimeoutError,
    AIProviderResponseError,
)
from app.ai.prompts import (
    FOOD_ANALYSIS_SYSTEM_PROMPT,
    FOOD_ANALYSIS_USER_PROMPT,
)

logger = logging.getLogger("nutrilens.ai.gemini")


_SENTINEL = object()


class GeminiVisionAIProvider(AIProvider):
    """
    Multimodal AI Vision Provider powered by Google Gemini.
    Provides structured visual food recognition, conservative portion estimation,
    and visual uncertainty detection. Strictly omits calorie/macro calculations.

    Includes bounded retries with exponential backoff and jitter for transient errors (503, 429, 500, 502, 504),
    a single fallback model if the primary model experiences high demand, and strict secret redaction.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        fallback_model: Any = _SENTINEL,
        timeout: Optional[float] = None,
        per_attempt_timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
        retry_base_delay: Optional[float] = None,
        retry_max_delay: Optional[float] = None,
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        raw_model = model_name or settings.GEMINI_MODEL or "gemini-3.8-flash"
        cleaned_model = str(raw_model).strip().strip("\"'")
        if cleaned_model.startswith("models/"):
            cleaned_model = cleaned_model[len("models/"):]
        self.model_name = cleaned_model or "gemini-3.8-flash"

        # Fallback model configuration
        raw_fallback = fallback_model if fallback_model is not _SENTINEL else settings.GEMINI_FALLBACK_MODEL
        if raw_fallback:
            cleaned_fallback = str(raw_fallback).strip().strip("\"'")
            if cleaned_fallback.startswith("models/"):
                cleaned_fallback = cleaned_fallback[len("models/"):]
            if cleaned_fallback.lower() in ("none", "null", "disabled", "false", ""):
                cleaned_fallback = None
            self.fallback_model = cleaned_fallback
        else:
            self.fallback_model = None

        # Prevent duplicate fallback execution if fallback model is identical to primary model
        if self.fallback_model and self.fallback_model == self.model_name:
            self.fallback_model = None

        self.timeout = timeout if timeout is not None else settings.AI_TIMEOUT_SECONDS
        self.per_attempt_timeout = (
            per_attempt_timeout
            if per_attempt_timeout is not None
            else getattr(settings, "AI_PER_ATTEMPT_TIMEOUT_SECONDS", 12.0)
        )
        self.max_retries = max_retries if max_retries is not None else settings.AI_MAX_RETRIES
        self.retry_base_delay = (
            retry_base_delay if retry_base_delay is not None else settings.AI_RETRY_BASE_DELAY_SECONDS
        )
        self.retry_max_delay = (
            retry_max_delay if retry_max_delay is not None else settings.AI_RETRY_MAX_DELAY_SECONDS
        )

        if self.api_key:
            self._client = genai.Client(api_key=self.api_key)
        else:
            self._client = None

    def _determine_mime_type(self, filename: str) -> str:
        ext = os.path.splitext(filename.lower())[1]
        if ext == ".png":
            return "image/png"
        elif ext == ".webp":
            return "image/webp"
        return "image/jpeg"

    def _sanitize_message(self, message: str) -> str:
        """Redact sensitive API keys and credentials from error messages and log entries."""
        if not message:
            return ""
        sanitized = str(message)
        if self.api_key and self.api_key in sanitized:
            sanitized = sanitized.replace(self.api_key, "[REDACTED_API_KEY]")
        # Redact Google API key query strings e.g. key=AIzaSy...
        sanitized = re.sub(r"key=[A-Za-z0-9_-]+", "key=[REDACTED_API_KEY]", sanitized)
        return sanitized

    def _is_permanent_error(self, exc: Exception) -> bool:
        """
        Determine if an exception represents a permanent failure that must NOT be retried:
        - 400 Bad Request / Invalid Argument
        - 401 Unauthorized / Invalid API Key
        - 403 Forbidden / Permission Denied
        - 404 Not Found / Model deprecated or unavailable
        """
        err_code = getattr(exc, "code", None)
        if err_code in (400, 401, 403, 404):
            return True

        err_str = str(exc).lower()
        permanent_patterns = [
            "401", "403", "unauthenticated", "invalid api key", "api_key_invalid",
            "permission denied", "forbidden",
            "404", "not found", "no longer available", "deprecated",
            "400", "bad request", "invalid_argument",
        ]
        return any(pattern in err_str for pattern in permanent_patterns)

    def _is_transient_error(self, exc: Exception) -> bool:
        """
        Determine if an exception represents a transient failure that is safe to retry:
        - 429 Too Many Requests / Resource Exhausted / Rate limit
        - 500 Internal Server Error
        - 502 Bad Gateway
        - 503 Service Unavailable / High Demand
        - 504 Gateway Timeout
        - ServerError from google.genai.errors
        - Network connection reset or timeout
        """
        if self._is_permanent_error(exc):
            return False

        err_code = getattr(exc, "code", None)
        if err_code in (429, 500, 502, 503, 504):
            return True

        if isinstance(exc, (ServerError, asyncio.TimeoutError, ConnectionError, TimeoutError)):
            return True

        err_str = str(exc).lower()
        transient_patterns = [
            "503", "unavailable", "high demand", "spikes in demand", "temporarily unavailable",
            "overloaded", "429", "resource_exhausted", "resource exhausted", "rate limit",
            "quota", "too many requests", "500", "internal server error", "502", "bad gateway",
            "504", "gateway timeout", "deadline exceeded", "timed out",
        ]
        return any(pattern in err_str for pattern in transient_patterns)

    def _extract_retry_after(self, exc: Exception) -> Optional[float]:
        """Extract Retry-After header in seconds from exception if present and bounded."""
        resp = getattr(exc, "response", None)
        if resp is not None:
            headers = getattr(resp, "headers", None)
            if headers and hasattr(headers, "items"):
                for k, v in headers.items():
                    if k.lower() == "retry-after":
                        try:
                            val = float(v)
                            if 0.0 < val <= 10.0:
                                return val
                        except (ValueError, TypeError):
                            pass
        return None

    def _build_content_config(self, model: str) -> types.GenerateContentConfig:
        """
        Build GenerateContentConfig tailored to the target model.
        For Gemini 3.x series models, configure thinking_level='low' to eliminate excessive reasoning latency.
        For Gemini 2.x and earlier models, omit thinking_config to avoid 400 INVALID_ARGUMENT errors.
        """
        config_kwargs: Dict[str, Any] = {
            "system_instruction": FOOD_ANALYSIS_SYSTEM_PROMPT,
            "response_mime_type": "application/json",
            "temperature": 0.2,
        }
        if "gemini-3" in model.lower():
            try:
                config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_level="low")
            except Exception:
                pass
        return types.GenerateContentConfig(**config_kwargs)

    async def _execute_generate_content_with_retry(
        self,
        image_part: types.Part,
        deadline: float,
        session_id: Optional[str] = None,
    ) -> Tuple[Any, str, bool, int]:
        """
        Executes generate_content with bounded exponential backoff and jitter for transient errors.
        Attempts the primary model up to (1 + max_retries) times with a per-attempt timeout.
        If primary model is exhausted due to transient issues, attempts the fallback model once.
        Returns: (response, model_used, fallback_used, total_attempts)
        """
        total_attempts = 0
        max_primary_attempts = 1 + max(0, self.max_retries)
        last_exception: Optional[Exception] = None
        session_tag = f"[session={session_id}] " if session_id else ""

        # 1. Primary model attempts with bounded backoff
        for attempt_idx in range(max_primary_attempts):
            total_attempts += 1
            remaining = deadline - time.time()
            if remaining <= 0.5:
                logger.error(
                    f"{session_tag}AI analysis deadline exceeded before primary attempt {attempt_idx + 1} "
                    f"(remaining: {remaining:.3f}s, total timeout: {self.timeout}s)."
                )
                raise AIProviderTimeoutError(
                    f"Food analysis timed out after {self.timeout} seconds. The vision service is experiencing high latency."
                )

            # Enforce per-attempt timeout so attempt 0 cannot monopolize the overall deadline
            current_attempt_timeout = min(self.per_attempt_timeout, remaining)
            attempt_start = time.time()

            try:
                content_config = self._build_content_config(self.model_name)
                response = await asyncio.wait_for(
                    self._client.aio.models.generate_content(
                        model=self.model_name,
                        contents=[image_part, FOOD_ANALYSIS_USER_PROMPT],
                        config=content_config,
                    ),
                    timeout=current_attempt_timeout,
                )
                attempt_duration_ms = round((time.time() - attempt_start) * 1000, 1)
                logger.info(
                    f"{session_tag}Primary model '{self.model_name}' attempt {attempt_idx + 1} "
                    f"succeeded in {attempt_duration_ms}ms."
                )
                return response, self.model_name, False, total_attempts

            except Exception as exc:
                last_exception = exc
                safe_err = self._sanitize_message(str(exc))
                attempt_duration_ms = round((time.time() - attempt_start) * 1000, 1)

                # Check permanent errors -> fail fast without retry
                if self._is_permanent_error(exc):
                    err_code = getattr(exc, "code", None)
                    is_model_unavailable = (
                        err_code == 404
                        or "404" in safe_err
                        or "not found" in safe_err.lower()
                        or "no longer available" in safe_err.lower()
                    )
                    if is_model_unavailable:
                        logger.error(
                            f"{session_tag}Gemini vision model '{self.model_name}' is unavailable or deprecated after {attempt_duration_ms}ms: {safe_err}"
                        )
                        raise AIProviderConfigError(
                            f"Configured Gemini vision model '{self.model_name}' is unavailable or deprecated. "
                            "Please update GEMINI_MODEL to a supported vision model (e.g. 'gemini-3.8-flash')."
                        )

                    if (
                        err_code in (401, 403)
                        or "api key" in safe_err.lower()
                        or "unauthenticated" in safe_err.lower()
                        or "permission denied" in safe_err.lower()
                    ):
                        logger.error(f"{session_tag}Gemini authentication failed after {attempt_duration_ms}ms: invalid or unauthorized API key.")
                        raise AIProviderConfigError(
                            "Invalid or unauthorized Gemini API key. Please check the GEMINI_API_KEY environment variable."
                        )

                    logger.error(f"{session_tag}Permanent Gemini API error on model '{self.model_name}' after {attempt_duration_ms}ms: {safe_err}")
                    raise AIProviderError(f"Multimodal vision provider error: {safe_err}")

                # Check if transient error
                if not self._is_transient_error(exc):
                    logger.error(f"{session_tag}Non-transient Gemini API error on model '{self.model_name}' after {attempt_duration_ms}ms: {safe_err}")
                    raise AIProviderError(f"Multimodal vision provider error: {safe_err}")

                # Transient error handling
                if attempt_idx < max_primary_attempts - 1:
                    # Check for Retry-After header
                    retry_after = self._extract_retry_after(exc)
                    if retry_after is not None:
                        delay = min(retry_after + random.uniform(0.0, 0.25), self.retry_max_delay)
                    else:
                        backoff = self.retry_base_delay * (2 ** attempt_idx)
                        jitter = random.uniform(0.0, 0.25)
                        delay = min(backoff + jitter, self.retry_max_delay)

                    # Check remaining time budget
                    remaining_after_sleep = (deadline - time.time()) - delay
                    if remaining_after_sleep <= 0.2:
                        logger.warning(
                            f"{session_tag}Cannot retry transient error on '{self.model_name}' (attempt {attempt_idx + 1}/{max_primary_attempts}): "
                            f"delay ({delay:.2f}s) would leave insufficient deadline ({deadline - time.time():.2f}s remaining)."
                        )
                        break

                    logger.warning(
                        f"{session_tag}Transient failure on model '{self.model_name}' "
                        f"(attempt {attempt_idx + 1}/{max_primary_attempts}, elapsed {attempt_duration_ms}ms): {safe_err}. Retrying in {delay:.2f}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.warning(
                        f"{session_tag}Exhausted all {max_primary_attempts} attempts on primary model '{self.model_name}' "
                        f"due to transient error: {safe_err}"
                    )

        # 2. Primary attempts exhausted. Attempt one fallback model if configured and different.
        if self.fallback_model and self.fallback_model != self.model_name:
            remaining = deadline - time.time()
            if remaining > 0.1:
                total_attempts += 1
                fallback_timeout = min(self.per_attempt_timeout, remaining)
                fb_start = time.time()
                logger.info(
                    f"{session_tag}Primary model '{self.model_name}' temporarily unavailable. "
                    f"Attempting fallback model '{self.fallback_model}' (timeout: {fallback_timeout:.1f}s, remaining: {remaining:.1f}s)..."
                )
                try:
                    fb_config = self._build_content_config(self.fallback_model)
                    fb_response = await asyncio.wait_for(
                        self._client.aio.models.generate_content(
                            model=self.fallback_model,
                            contents=[image_part, FOOD_ANALYSIS_USER_PROMPT],
                            config=fb_config,
                        ),
                        timeout=fallback_timeout,
                    )
                    fb_duration_ms = round((time.time() - fb_start) * 1000, 1)
                    logger.info(f"{session_tag}Fallback model '{self.fallback_model}' succeeded in {fb_duration_ms}ms.")
                    return fb_response, self.fallback_model, True, total_attempts
                except Exception as fb_exc:
                    last_exception = fb_exc
                    safe_fb_err = self._sanitize_message(str(fb_exc))
                    fb_duration_ms = round((time.time() - fb_start) * 1000, 1)
                    logger.error(f"{session_tag}Fallback model '{self.fallback_model}' failed after {fb_duration_ms}ms: {safe_fb_err}")
                    if self._is_permanent_error(fb_exc):
                        err_code = getattr(fb_exc, "code", None)
                        if err_code in (401, 403) or "api key" in safe_fb_err.lower():
                            raise AIProviderConfigError("Invalid or unauthorized Gemini API key.")
            else:
                logger.warning(
                    f"{session_tag}Insufficient time remaining ({remaining:.2f}s) to attempt fallback model '{self.fallback_model}'."
                )

        # 3. Both primary (and fallback) failed due to transient conditions or timeout
        if isinstance(last_exception, asyncio.TimeoutError):
            raise AIProviderTimeoutError(
                f"Food analysis timed out after {self.timeout} seconds. The vision service is experiencing high latency."
            )

        raise AIProviderUnavailableError(
            "The AI vision service is currently experiencing high demand. Please try again in a few moments."
        )

    async def analyze_food_image(
        self, image_bytes: bytes, filename: str, session_id: Optional[str] = None
    ) -> AIAnalysisResult:
        if not self.api_key or not self._client:
            logger.error("GEMINI_API_KEY is not configured.")
            raise AIProviderConfigError(
                "Gemini API key is not configured. Please set the GEMINI_API_KEY environment variable."
            )

        session_tag = f"[session={session_id}] " if session_id else ""
        mime_type = self._determine_mime_type(filename)
        start_time = time.time()
        deadline = start_time + self.timeout
        logger.info(
            f"{session_tag}Starting multimodal food analysis with model '{self.model_name}' "
            f"(fallback: '{self.fallback_model}', timeout: {self.timeout}s, per_attempt: {self.per_attempt_timeout}s) "
            f"for file '{filename}' ({len(image_bytes)} bytes)..."
        )

        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

        response, active_model, fallback_used, attempts = await self._execute_generate_content_with_retry(
            image_part=image_part,
            deadline=deadline,
            session_id=session_id,
        )

        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.info(
            f"{session_tag}Gemini API responded in {duration_ms}ms using model '{active_model}' "
            f"(attempts: {attempts}, fallback_used: {fallback_used})."
        )

        raw_text = response.text or "{}"
        try:
            data = json.loads(raw_text)
        except Exception as e:
            logger.error(f"Failed to parse JSON from Gemini response: {raw_text[:200]}...")
            raise AIProviderResponseError(
                f"Vision provider returned non-JSON or malformed output: {str(e)}"
            )

        # Parse structured detected foods
        raw_foods = data.get("foods", [])
        detected_candidates: List[DetectedItemCandidate] = []

        for item in raw_foods:
            name = item.get("name", "Unknown Food").strip()
            conf = float(item.get("confidence", 0.7))
            conf = max(0.0, min(1.0, conf))

            portion_data = item.get("estimated_portion", {})
            try:
                p_val = float(portion_data.get("value", 100.0))
            except (ValueError, TypeError):
                p_val = 100.0
            p_unit = str(portion_data.get("unit", "g"))
            p_display = portion_data.get("display_text")

            portion = EstimatedPortion(
                value=p_val,
                unit=p_unit,
                display_text=p_display,
            )

            detected_candidates.append(
                DetectedItemCandidate(
                    name=name,
                    confidence=conf,
                    estimated_portion=portion,
                    description=item.get("description"),
                    ingredients=item.get("ingredients", []),
                    uncertainties=item.get("uncertainties", []),
                )
            )

        overall_conf = float(data.get("overall_confidence", 0.75))
        overall_conf = max(0.0, min(1.0, overall_conf))
        uncertainties = data.get("uncertainties", [])
        if not uncertainties and detected_candidates:
            uncertainties = [
                "Exact oil and seasoning content cannot be determined from the image",
                "Portion size is estimated from the visible angle and plate perspective",
            ]

        return AIAnalysisResult(
            status="success",
            detected_foods=detected_candidates,
            overall_confidence=overall_conf,
            uncertainties=uncertainties,
            recommendations=[],
            phase_notice="Food items and portions estimated via Multimodal Vision AI. Nutrition calculations are performed deterministically in the subsequent step.",
            processing_metadata={
                "provider": "GeminiVisionAIProvider",
                "model": active_model,
                "duration_ms": duration_ms,
                "items_detected": len(detected_candidates),
                "fallback_used": fallback_used,
                "attempts": attempts,
            },
        )

    async def identify_food_items(
        self, image_bytes: bytes
    ) -> List[DetectedItemCandidate]:
        result = await self.analyze_food_image(image_bytes, "image.jpg")
        return result.detected_foods

    async def generate_meal_recommendations(
        self, meal_summary: Dict[str, Any], user_goal: str = "balanced"
    ) -> List[AIRecommendation]:
        # Recommendations will be expanded in future phases
        return []

    async def explain_meal_optimization(
        self,
        goal: str,
        original_nutrition: Dict[str, Any],
        optimized_nutrition: Dict[str, Any],
        changes: List[str],
    ) -> str:
        prompt = (
            f"You are the NutriLens Food Intelligence Explanation Assistant.\n"
            f"Explain clearly and concisely (1-2 sentences) why the following proposed meal adjustments "
            f"improve this meal for the user's '{goal}' goal.\n\n"
            f"Original meal: {original_nutrition.get('calories')} kcal, {original_nutrition.get('protein')}g protein, {original_nutrition.get('fiber')}g fiber.\n"
            f"Optimized meal: {optimized_nutrition.get('calories')} kcal, {optimized_nutrition.get('protein')}g protein, {optimized_nutrition.get('fiber')}g fiber.\n"
            f"Specific modifications: {', '.join(changes)}.\n\n"
            f"RULES:\n"
            f"1. Explain the rationale in 1 or 2 encouraging sentences.\n"
            f"2. Do NOT invent new numbers or foods.\n"
            f"3. Do NOT give medical advice or diagnose any condition.\n"
            f"4. Focus on satiety, energy balance, protein, and dietary fiber."
        )
        if self._client:
            models_to_try = [self.model_name]
            if self.fallback_model and self.fallback_model != self.model_name:
                models_to_try.append(self.fallback_model)
            for m in models_to_try:
                try:
                    response = await self._client.aio.models.generate_content(
                        model=m,
                        contents=prompt,
                    )
                    if response and response.text:
                        return response.text.strip().replace("\n", " ")
                except Exception:
                    continue

        # Robust fallback
        from app.ai.placeholder_provider import PlaceholderAIProvider
        return await PlaceholderAIProvider().explain_meal_optimization(
            goal=goal,
            original_nutrition=original_nutrition,
            optimized_nutrition=optimized_nutrition,
            changes=changes,
        )
