"""Firebase Admin SDK initialization and ID token verification.

Initializes Firebase Admin for server-side ID token verification.
Supports three credential modes:
1. FIREBASE_SERVICE_ACCOUNT_JSON env var (base64 or raw JSON)
2. GOOGLE_APPLICATION_CREDENTIALS file path (standard ADC)
3. Project-ID-only mode for token verification via Google public x509 certificates.
   Uses an anonymous/unauthenticated credential so the Firebase client does not
   attempt to invoke google.auth.default() on non-GCP hosts (e.g. Render).

Includes dual-layer verification and safe diagnostic logging that classifies
errors by category without exposing tokens, secrets, or user data.
"""
import os
import json
import base64
import logging
from typing import Optional, Dict, Any

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials as firebase_credentials
from firebase_admin import _token_gen

from app.core.config import settings

logger = logging.getLogger("nutrilens.firebase")

_firebase_app: Optional[firebase_admin.App] = None
_initialized = False


class _PublicKeysOnlyCredential(firebase_credentials.Base):
    """
    Credential for public-key ID token verification on hosts without GCP service accounts.
    Provides anonymous Google credentials to satisfy Firebase App requirements while allowing
    ID token verification against Google's public certificates.
    """
    def get_credential(self):
        import google.auth.credentials
        return google.auth.credentials.AnonymousCredentials()


def _parse_service_account_json(raw: str) -> Optional[Dict[str, Any]]:
    """Parse service account JSON from raw string or base64-encoded string.
    Never logs the credential content."""
    if not raw or not raw.strip():
        return None
    raw = raw.strip()

    # Try raw JSON first
    if raw.startswith("{"):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("[Firebase Config] FIREBASE_SERVICE_ACCOUNT_JSON starts with '{' but failed JSON decoding.")
            return None

    # Try base64 decoding
    try:
        decoded = base64.b64decode(raw).decode("utf-8")
        return json.loads(decoded)
    except Exception:
        logger.warning("[Firebase Config] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON or base64-encoded JSON.")
        return None


def initialize_firebase() -> bool:
    """Initialize Firebase Admin SDK. Returns True if initialization succeeded."""
    global _firebase_app, _initialized

    if _initialized:
        return _firebase_app is not None

    _initialized = True

    # Check if already initialized (e.g. by another module or test)
    try:
        _firebase_app = firebase_admin.get_app()
        logger.info(f"[Firebase Init] Firebase Admin SDK already initialized (App: '{_firebase_app.name}').")
        return True
    except ValueError:
        pass  # Not yet initialized

    project_id = (settings.FIREBASE_PROJECT_ID or "nutrilens-dc1f9").strip().strip("\"'")

    # Mode 1: Service account JSON from environment variable
    sa_json = settings.FIREBASE_SERVICE_ACCOUNT_JSON or os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    sa_info = _parse_service_account_json(sa_json)
    if sa_info:
        try:
            cred = firebase_credentials.Certificate(sa_info)
            _firebase_app = firebase_admin.initialize_app(cred, options={"projectId": project_id})
            logger.info(f"[Firebase Init] Initialized with Service Account Certificate (Project: '{project_id}').")
            return True
        except Exception as e:
            logger.error(f"[Firebase Init] Failed to initialize with Service Account: {type(e).__name__}: {e}")

    # Mode 2: GOOGLE_APPLICATION_CREDENTIALS file path (standard ADC)
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        try:
            cred = firebase_credentials.ApplicationDefault()
            _firebase_app = firebase_admin.initialize_app(cred, options={"projectId": project_id})
            logger.info(f"[Firebase Init] Initialized with Application Default Credentials (Project: '{project_id}').")
            return True
        except Exception as e:
            logger.error(f"[Firebase Init] Failed to initialize with ADC: {type(e).__name__}: {e}")

    # Mode 3: Project-ID-only mode (Public Key Verification)
    # Uses _PublicKeysOnlyCredential to avoid DefaultCredentialsError when running on Render/non-GCP hosts.
    if project_id:
        try:
            cred = _PublicKeysOnlyCredential()
            _firebase_app = firebase_admin.initialize_app(
                credential=cred,
                options={"projectId": project_id},
            )
            logger.info(
                f"[Firebase Init] Initialized in Public-Key Verification mode for project '{project_id}'. "
                "Tokens will be verified against Google public x509 certificates."
            )
            return True
        except Exception as e:
            logger.error(f"[Firebase Init] Failed to initialize in Public-Key mode: {type(e).__name__}: {e}")

    logger.warning(
        "[Firebase Init] Firebase Admin SDK could not be initialized. "
        "Set FIREBASE_PROJECT_ID in environment."
    )
    return False


def verify_firebase_id_token(id_token: str) -> Dict[str, Any]:
    """Verify a Firebase ID token and return the decoded claims.

    Cryptographically validates:
    1. Signature against Google's public x509 certificates
    2. Header algorithm is RS256
    3. Token audience ('aud') matches configured FIREBASE_PROJECT_ID
    4. Token issuer ('iss') matches https://securetoken.google.com/<FIREBASE_PROJECT_ID>
    5. Token expiration ('exp') is in the future
    6. Token issued-at ('iat') and auth_time are in the past
    7. Subject ('sub' / 'uid') is present and non-empty

    Safe Diagnostic Logging:
    Logs error category, exception class, and safe description.
    NEVER logs token strings, private keys, or secret values.

    Raises:
        ValueError: If verification fails, detailing the specific failure category.
    """
    if not _initialized:
        initialize_firebase()

    if _firebase_app is None:
        logger.error("[Firebase Auth] Verification rejected: Firebase Admin SDK is not initialized.")
        raise ValueError("Firebase authentication service is not initialized on this server.")

    if not id_token or not isinstance(id_token, str) or len(id_token.strip()) < 10:
        logger.warning("[Firebase Auth] Verification rejected: Token is empty or malformed.")
        raise ValueError("Invalid Firebase ID token: token is empty or malformed.")

    cleaned_token = id_token.strip()
    project_id = (settings.FIREBASE_PROJECT_ID or "nutrilens-dc1f9").strip().strip("\"'")

    decoded_token: Optional[Dict[str, Any]] = None

    def _safe_err(e: Exception) -> str:
        msg = str(e)
        if cleaned_token and cleaned_token in msg:
            msg = msg.replace(cleaned_token, "[REDACTED_TOKEN]")
        token_bytes = f"b'{cleaned_token}'"
        if token_bytes in msg:
            msg = msg.replace(token_bytes, "[REDACTED_TOKEN]")
        return msg

    # Step A: Primary verification via official Firebase Admin SDK
    try:
        decoded_token = firebase_auth.verify_id_token(
            cleaned_token,
            app=_firebase_app,
            check_revoked=False,
        )
    except firebase_auth.RevokedIdTokenError as e:
        safe_msg = _safe_err(e)
        logger.warning(f"[Firebase Auth] Verification rejected [Category: TOKEN_REVOKED]: {safe_msg}")
        raise ValueError("Firebase ID token has been revoked.")
    except firebase_auth.ExpiredIdTokenError as e:
        safe_msg = _safe_err(e)
        logger.warning(f"[Firebase Auth] Verification rejected [Category: TOKEN_EXPIRED]: {safe_msg}")
        raise ValueError("Firebase ID token has expired. Please sign in again.")
    except firebase_auth.InvalidIdTokenError as e:
        safe_msg = _safe_err(e)
        logger.warning(f"[Firebase Auth] Verification rejected [Category: INVALID_TOKEN]: {safe_msg}")
        raise ValueError(f"Invalid Firebase ID token: {safe_msg}")
    except firebase_auth.CertificateFetchError as e:
        safe_msg = _safe_err(e)
        logger.error(f"[Firebase Auth] Verification failed [Category: CERTIFICATE_FETCH_ERROR]: {safe_msg}")
        raise ValueError("Failed to fetch Google public certificates for token verification.")
    except Exception as exc:
        safe_exc = _safe_err(exc)
        logger.warning(
            f"[Firebase Auth] SDK auth.verify_id_token raised {type(exc).__name__}: {safe_exc}. "
            f"Invoking direct TokenVerifier for project '{project_id}'..."
        )
        try:
            verifier = _token_gen.TokenVerifier(_firebase_app)
            decoded_token = verifier.verify_id_token(cleaned_token)
            logger.info("[Firebase Auth] Token successfully verified via direct TokenVerifier fallback.")
        except firebase_auth.RevokedIdTokenError as e:
            safe_msg = _safe_err(e)
            logger.warning(f"[Firebase Auth] Fallback rejected [Category: TOKEN_REVOKED]: {safe_msg}")
            raise ValueError("Firebase ID token has been revoked.")
        except firebase_auth.ExpiredIdTokenError as e:
            safe_msg = _safe_err(e)
            logger.warning(f"[Firebase Auth] Fallback rejected [Category: TOKEN_EXPIRED]: {safe_msg}")
            raise ValueError("Firebase ID token has expired. Please sign in again.")
        except firebase_auth.InvalidIdTokenError as e:
            safe_msg = _safe_err(e)
            logger.warning(f"[Firebase Auth] Fallback rejected [Category: INVALID_TOKEN]: {safe_msg}")
            raise ValueError(f"Invalid Firebase ID token: {safe_msg}")
        except firebase_auth.CertificateFetchError as e:
            safe_msg = _safe_err(e)
            logger.error(f"[Firebase Auth] Fallback failed [Category: CERTIFICATE_FETCH_ERROR]: {safe_msg}")
            raise ValueError("Failed to fetch Google public certificates for token verification.")
        except Exception as fallback_exc:
            safe_fb = _safe_err(fallback_exc)
            logger.error(
                f"[Firebase Auth] All verification attempts failed [Category: UNEXPECTED_ERROR] "
                f"({type(fallback_exc).__name__}): {safe_fb}"
            )
            raise ValueError(f"Firebase ID token verification failed: {type(fallback_exc).__name__}")

    # Validate required claims
    uid = decoded_token.get("uid") or decoded_token.get("sub")
    if not uid:
        logger.warning("[Firebase Auth] Verification rejected [Category: MISSING_UID_CLAIM]: Token has no uid/sub claim.")
        raise ValueError("Firebase ID token missing 'uid' claim.")

    decoded_token["uid"] = uid
    return decoded_token


def is_firebase_available() -> bool:
    """Check if Firebase Admin SDK is initialized and available."""
    if not _initialized:
        initialize_firebase()
    return _firebase_app is not None


def reset_for_testing() -> None:
    """Reset Firebase initialization state for test isolation. Only use in tests."""
    global _firebase_app, _initialized
    try:
        if _firebase_app is not None:
            firebase_admin.delete_app(_firebase_app)
    except Exception:
        pass
    _firebase_app = None
    _initialized = False
