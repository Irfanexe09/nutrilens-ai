import os
import uuid
import time
import logging
from typing import Tuple, Dict, Any
from fastapi import UploadFile, HTTPException, status
from PIL import Image
import io

from app.core.config import settings
from app.ai.factory import get_ai_provider
from app.ai.base import (
    AIProviderError,
    AIProviderConfigError,
    AIProviderTimeoutError,
    AIProviderResponseError,
)
from app.schemas.analyze import (
    FoodAnalysisResponse,
    FoodAnalysisData,
    DetectedFoodSchema,
    EstimatedPortionSchema,
)

logger = logging.getLogger("nutrilens.services.analysis")


class AnalysisService:
    @classmethod
    def cleanup_old_uploads(cls, max_age_seconds: int = 86400) -> int:
        """
        Removes temporary food upload files older than max_age_seconds.
        Prevents unbounded disk storage growth from transient uploads.
        """
        removed = 0
        if not os.path.exists(settings.UPLOAD_DIR):
            return 0
        now = time.time()
        for fname in os.listdir(settings.UPLOAD_DIR):
            if fname.startswith("."):
                continue
            fpath = os.path.join(settings.UPLOAD_DIR, fname)
            try:
                if os.path.isfile(fpath):
                    mtime = os.path.getmtime(fpath)
                    if (now - mtime) > max_age_seconds:
                        os.remove(fpath)
                        removed += 1
            except Exception as e:
                logger.warning(f"Failed to remove stale upload '{fname}': {e}")
        return removed

    @staticmethod
    def validate_image_file(file: UploadFile, content: bytes) -> Tuple[int, int]:
        """
        Validates content type, file size, actual decoded format, dimensions,
        and verifies image integrity with Pillow decompression bomb protection.
        Returns (width, height).
        """
        if not content or len(content) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image file received.",
            )

        if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
            max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"Image file exceeds maximum allowable size of {max_mb}MB.",
            )

        # Check content type header
        content_type = (file.content_type or "").lower().split(";")[0].strip()
        if content_type not in settings.ALLOWED_IMAGE_TYPES:
            allowed = ", ".join(settings.ALLOWED_IMAGE_TYPES)
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported image format: {file.content_type}. Allowed types: {allowed}",
            )

        # Enforce Pillow decompression bomb limit
        Image.MAX_IMAGE_PIXELS = settings.MAX_IMAGE_PIXELS

        # Verify image integrity and decode structure
        try:
            image = Image.open(io.BytesIO(content))
            image.verify()  # Verifies file header and structure

            # Reopen to get format and dimensions (verify() closes/invalidates the image stream)
            image = Image.open(io.BytesIO(content))
            decoded_format = (image.format or "").upper()
            if decoded_format not in ["JPEG", "PNG", "WEBP"]:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail=f"Unsupported decoded image format: {decoded_format}. Allowed formats: JPEG, PNG, WEBP.",
                )

            width, height = image.size
            if width > 6000 or height > 6000 or (width * height) > settings.MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Image resolution exceeds maximum allowable limits (max 6000x6000px or 25 megapixels). Possible decompression bomb.",
                )
            return width, height
        except HTTPException:
            raise
        except Image.DecompressionBombError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image exceeded maximum allowable pixel count (Pillow decompression bomb protection).",
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is corrupted or not a valid image.",
            )

    @classmethod
    async def process_food_image(
        cls, file: UploadFile
    ) -> FoodAnalysisResponse:
        req_start_time = time.time()
        filename = file.filename or "uploaded_meal.jpg"
        logger.info(f"Analysis request started for image: '{filename}'")

        content = await file.read()
        width, height = cls.validate_image_file(file, content)

        # Trigger safe background transient cleanup of stale uploads
        try:
            cls.cleanup_old_uploads(settings.IMAGE_RETENTION_SECONDS)
        except Exception:
            pass

        # Generate unique identifier and store file safely
        session_id = str(uuid.uuid4())
        ext = os.path.splitext(filename)[1].lower()
        if not ext or ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            ext = ".jpg"

        stored_filename = f"{session_id}{ext}"
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(settings.UPLOAD_DIR, stored_filename)

        with open(file_path, "wb") as f:
            f.write(content)

        # Select configured AI Provider
        provider = get_ai_provider()
        provider_name = provider.__class__.__name__
        logger.info(f"AI analysis started using provider: '{provider_name}' for session: '{session_id}'")

        try:
            ai_result = await provider.analyze_food_image(
                image_bytes=content, filename=filename
            )
        except AIProviderConfigError as e:
            logger.error(f"AI provider configuration error in session {session_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AI Vision Provider is not configured. Please ensure GEMINI_API_KEY is configured in your environment.",
            )
        except AIProviderTimeoutError as e:
            logger.error(f"AI analysis timed out in session {session_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Food analysis timed out. The multimodal vision model took too long to respond. Please try again.",
            )
        except (AIProviderResponseError, AIProviderError) as e:
            logger.error(f"AI analysis failed in session {session_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Food analysis failed. The vision service could not process this image. Please try again.",
            )
        except Exception as e:
            logger.error(f"Unexpected error during AI analysis in session {session_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred during food image analysis. Please try again.",
            )

        duration_ms = round((time.time() - req_start_time) * 1000, 2)
        logger.info(
            f"AI analysis succeeded for session '{session_id}' in {duration_ms}ms. "
            f"Detected {len(ai_result.detected_foods)} foods (overall confidence: {ai_result.overall_confidence:.2f})."
        )

        detected_schemas: list[DetectedFoodSchema] = []
        for item in ai_result.detected_foods:
            portion_schema = EstimatedPortionSchema(
                value=item.estimated_portion.value,
                unit=item.estimated_portion.unit,
                display_text=item.estimated_portion.display_text,
            )
            detected_schemas.append(
                DetectedFoodSchema(
                    name=item.name,
                    estimated_portion=portion_schema,
                    confidence=item.confidence,
                    description=item.description,
                    ingredients=item.ingredients,
                    uncertainties=item.uncertainties,
                    matched_food_id=item.matched_food_id,
                    suggested_serving_size=item.estimated_portion.value,
                    suggested_serving_unit=item.estimated_portion.unit,
                )
            )

        analysis_data = FoodAnalysisData(
            foods=detected_schemas,
            overall_confidence=ai_result.overall_confidence,
            uncertainties=ai_result.uncertainties,
        )

        image_metadata: Dict[str, Any] = {
            "original_filename": filename,
            "stored_filename": stored_filename,
            "size_bytes": len(content),
            "dimensions": f"{width}x{height}",
            "content_type": file.content_type,
            "relative_url": f"/uploads/{stored_filename}",
        }

        return FoodAnalysisResponse(
            meal_id=session_id,
            status="success",
            analysis=analysis_data,
            foods=detected_schemas,
            overall_confidence=ai_result.overall_confidence,
            uncertainties=ai_result.uncertainties,
            notice="Nutrition calculation will be available after confirmation.",
            image_metadata=image_metadata,
            provider=provider_name,
            duration_ms=duration_ms,
        )
