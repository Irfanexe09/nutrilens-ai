"""Firebase Admin SDK initialization and ID token verification.

Initializes Firebase Admin for server-side ID token verification.
Supports three credential modes:
1. FIREBASE_SERVICE_ACCOUNT_JSON env var (base64 or raw JSON)
2. GOOGLE_APPLICATION_CREDENTIALS file path (standard ADC)
3. Project-ID-only mode for token verification without service account

Never logs or exposes credentials.
"""
import os
import json
import base64
import logging
from typing import Optional, Dict, Any

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials as firebase_credentials

from app.core.config import settings

logger = logging.getLogger("nutrilens.firebase")

_firebase_app: Optional[firebase_admin.App] = None
_initialized = False


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
            logger.warning("FIREBASE_SERVICE_ACCOUNT_JSON looks like JSON but failed to parse.")
            return None

    # Try base64 decoding
    try:
        decoded = base64.b64decode(raw).decode("utf-8")
        return json.loads(decoded)
    except Exception:
        logger.warning("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON or base64-encoded JSON.")
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
        logger.info("Firebase Admin SDK already initialized.")
        return True
    except ValueError:
        pass  # Not yet initialized

    project_id = settings.FIREBASE_PROJECT_ID

    # Mode 1: Service account JSON from environment variable
    sa_json = settings.FIREBASE_SERVICE_ACCOUNT_JSON or os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    sa_info = _parse_service_account_json(sa_json)
    if sa_info:
        try:
            cred = firebase_credentials.Certificate(sa_info)
            _firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized with service account credentials.")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin with service account: {e}")

    # Mode 2: GOOGLE_APPLICATION_CREDENTIALS file path (standard ADC)
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        try:
            cred = firebase_credentials.ApplicationDefault()
            _firebase_app = firebase_admin.initialize_app(cred, options={"projectId": project_id})
            logger.info("Firebase Admin SDK initialized with Application Default Credentials.")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin with ADC: {e}")

    # Mode 3: Project-ID-only (token verification still works via Google public keys)
    if project_id:
        try:
            _firebase_app = firebase_admin.initialize_app(
                options={"projectId": project_id}
            )
            logger.info(f"Firebase Admin SDK initialized with project ID only (token verification mode).")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin with project ID: {e}")

    logger.warning(
        "Firebase Admin SDK not initialized. Firebase authentication will be unavailable. "
        "Set FIREBASE_PROJECT_ID and optionally FIREBASE_SERVICE_ACCOUNT_JSON."
    )
    return False


def verify_firebase_id_token(id_token: str) -> Dict[str, Any]:
    """Verify a Firebase ID token and return the decoded claims.

    Raises:
        ValueError: If Firebase is not initialized or token is invalid/expired.
    """
    if not _initialized:
        initialize_firebase()

    if _firebase_app is None:
        raise ValueError("Firebase Admin SDK is not initialized. Cannot verify ID tokens.")

    if not id_token or not isinstance(id_token, str) or len(id_token.strip()) < 10:
        raise ValueError("Invalid Firebase ID token: token is empty or malformed.")

    try:
        decoded_token = firebase_auth.verify_id_token(
            id_token.strip(),
            app=_firebase_app,
            check_revoked=False,  # Requires service account; skip if using project-ID-only mode
        )
    except firebase_auth.RevokedIdTokenError:
        raise ValueError("Firebase ID token has been revoked.")
    except firebase_auth.ExpiredIdTokenError:
        raise ValueError("Firebase ID token has expired. Please sign in again.")
    except firebase_auth.InvalidIdTokenError as e:
        raise ValueError(f"Invalid Firebase ID token: {e}")
    except firebase_auth.CertificateFetchError as e:
        raise ValueError(f"Failed to fetch Firebase public keys for verification: {e}")
    except Exception as e:
        # Catch-all for unexpected SDK errors; do not expose internal details
        logger.error(f"Unexpected error verifying Firebase ID token: {type(e).__name__}")
        raise ValueError("Firebase ID token verification failed.")

    # Validate required claims
    uid = decoded_token.get("uid")
    if not uid:
        raise ValueError("Firebase ID token missing 'uid' claim.")

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
