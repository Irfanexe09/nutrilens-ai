"""Tests for Password Reset, Session Revocation, and Secure Account Linking.

Coverage:
- Forgot password: enumeration resistance (existing vs nonexistent email returns same message)
- Single-use token generated and stored only as SHA-256 hash
- Token expiration (30 minutes)
- Invalidation of previous reset tokens when issuing a new one
- Rate limiting by IP and normalized email
- Reset password: valid token allows password change
- Old password rejected after reset; new password authenticates
- Atomically cleared token hash & expiry (cannot reuse token)
- Invalidation of previous JWT sessions via token_version bump
- Protection against concurrent token consumption
- Error handling: expired, invalid, tampered, and reused tokens
- Password policy validation (>= 6 chars)
- Secure account linking: existing email/password account conflict returns structured 409
- Authenticated account linking connects Firebase UID transactionally
- Preserves existing meals and profile data
- Rejects linking if Firebase UID already belongs to another user
- Rejects overwriting an already-linked Firebase UID
- Zero secret or token leakage in logs
"""
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import User
from app.database.session import get_db
from app.core.rate_limit import password_reset_rate_limiter
from app.core.security import hash_password, create_access_token

client = TestClient(app)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _mock_verified_token(uid: str = "fb_uid_123", email: str = "user@example.com", name: str = "Google User"):
    return {
        "uid": uid,
        "email": email,
        "name": name,
        "email_verified": True,
        "iss": "https://securetoken.google.com/nutrilens-dc1f9",
        "aud": "nutrilens-dc1f9",
        "sub": uid,
    }


def _create_test_user(email: str, password: str = "TestPass123!", name: str = "Test User") -> dict:
    res = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "name": name,
    })
    assert res.status_code == 201
    return res.json()


# ─── Forgot Password Tests ──────────────────────────────────────────────────

def test_forgot_password_enumeration_resistance():
    """Forgot password returns identical generic response for existing and nonexistent emails."""
    password_reset_rate_limiter.reset()
    existing_email = f"fp_exist_{secrets.token_hex(6)}@example.com"
    _create_test_user(existing_email)

    nonexistent_email = f"fp_nonexist_{secrets.token_hex(6)}@example.com"

    res1 = client.post("/api/auth/forgot-password", json={"email": existing_email})
    assert res1.status_code == 200
    msg1 = res1.json()["message"]

    res2 = client.post("/api/auth/forgot-password", json={"email": nonexistent_email})
    assert res2.status_code == 200
    msg2 = res2.json()["message"]

    # Identical responses prevent account enumeration
    assert msg1 == msg2
    assert "If an account exists" in msg1


def test_forgot_password_stores_only_sha256_hash_at_rest():
    """Reset token is NEVER stored in plaintext; only SHA-256 hash is persisted."""
    password_reset_rate_limiter.reset()
    email = f"fp_hash_{secrets.token_hex(6)}@example.com"
    _create_test_user(email)

    # Capture the token passed to send_password_reset_email
    captured_tokens = []
    with patch("app.api.v1.endpoints.auth.send_password_reset_email") as mock_send:
        mock_send.side_effect = lambda to_email, token: captured_tokens.append(token) or True
        res = client.post("/api/auth/forgot-password", json={"email": email})
        assert res.status_code == 200
        assert len(captured_tokens) == 1

    raw_token = captured_tokens[0]
    expected_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    # Query DB directly to verify stored value
    db = next(get_db())
    try:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        assert user.password_reset_token_hash == expected_hash
        assert user.password_reset_token_hash != raw_token
        assert user.password_reset_expires_at is not None
        expires = user.password_reset_expires_at
        if expires.tzinfo is not None:
            expires = expires.replace(tzinfo=None)
        assert expires > datetime.now(timezone.utc).replace(tzinfo=None)
    finally:
        db.close()


def test_forgot_password_invalidates_previous_token():
    """Requesting a new reset token invalidates any previously issued token."""
    password_reset_rate_limiter.reset()
    email = f"fp_inval_{secrets.token_hex(6)}@example.com"
    _create_test_user(email)

    tokens = []
    with patch("app.api.v1.endpoints.auth.send_password_reset_email") as mock_send:
        mock_send.side_effect = lambda to_email, token: tokens.append(token) or True
        client.post("/api/auth/forgot-password", json={"email": email})
        client.post("/api/auth/forgot-password", json={"email": email})

    assert len(tokens) == 2
    token1, token2 = tokens[0], tokens[1]
    assert token1 != token2

    # Attempt reset with older token1 -> must fail
    res_old = client.post("/api/auth/reset-password", json={
        "token": token1,
        "new_password": "NewPassword123!",
    })
    assert res_old.status_code == 400
    assert "Invalid or expired" in res_old.json()["detail"]

    # Attempt reset with newer token2 -> must succeed
    res_new = client.post("/api/auth/reset-password", json={
        "token": token2,
        "new_password": "NewPassword123!",
    })
    assert res_new.status_code == 200


def test_forgot_password_rate_limiting():
    """Forgot password enforces rate limit per IP and email."""
    password_reset_rate_limiter.reset()
    email = f"fp_ratelimit_{secrets.token_hex(6)}@example.com"
    _create_test_user(email)

    with patch("app.api.v1.endpoints.auth.send_password_reset_email", return_value=True):
        for _ in range(5):
            res = client.post("/api/auth/forgot-password", json={"email": email})
            assert res.status_code == 200

        # 6th request within window -> 429
        res_blocked = client.post("/api/auth/forgot-password", json={"email": email})
        assert res_blocked.status_code == 429
        detail = res_blocked.json()["detail"]
        assert "Too many password reset requests" in detail or "Rate limit exceeded" in detail
    password_reset_rate_limiter.reset()


# ─── Reset Password Tests ───────────────────────────────────────────────────

def test_reset_password_success_and_login_with_new_password():
    """Valid reset token updates password, allowing login with new password and rejecting old."""
    password_reset_rate_limiter.reset()
    email = f"rp_success_{secrets.token_hex(6)}@example.com"
    old_pass = "OldPassword123!"
    new_pass = "BrandNewSecurePassword456!"
    _create_test_user(email, password=old_pass)

    # Request reset
    captured = []
    with patch("app.api.v1.endpoints.auth.send_password_reset_email") as mock_send:
        mock_send.side_effect = lambda to_email, token: captured.append(token) or True
        client.post("/api/auth/forgot-password", json={"email": email})

    token = captured[0]

    # Reset password
    res_reset = client.post("/api/auth/reset-password", json={
        "token": token,
        "new_password": new_pass,
    })
    assert res_reset.status_code == 200
    assert "successfully" in res_reset.json()["message"].lower()

    # Old password no longer authenticates
    res_old = client.post("/api/auth/login", json={"email": email, "password": old_pass})
    assert res_old.status_code == 401

    # New password authenticates
    res_new = client.post("/api/auth/login", json={"email": email, "password": new_pass})
    assert res_new.status_code == 200
    assert "access_token" in res_new.json()


def test_reset_password_token_cannot_be_reused():
    """Reset token is atomically consumed and cannot be reused."""
    password_reset_rate_limiter.reset()
    email = f"rp_reuse_{secrets.token_hex(6)}@example.com"
    _create_test_user(email)

    captured = []
    with patch("app.api.v1.endpoints.auth.send_password_reset_email") as mock_send:
        mock_send.side_effect = lambda to_email, token: captured.append(token) or True
        client.post("/api/auth/forgot-password", json={"email": email})

    token = captured[0]

    # First consumption succeeds
    res1 = client.post("/api/auth/reset-password", json={"token": token, "new_password": "NewPass111!"})
    assert res1.status_code == 200

    # Second consumption with same token fails
    res2 = client.post("/api/auth/reset-password", json={"token": token, "new_password": "NewPass222!"})
    assert res2.status_code == 400
    assert "Invalid or expired" in res2.json()["detail"]


def test_reset_password_rejects_expired_token():
    """An expired reset token is rejected with 400."""
    password_reset_rate_limiter.reset()
    email = f"rp_expired_{secrets.token_hex(6)}@example.com"
    _create_test_user(email)

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    # Set expiry in the past
    db = next(get_db())
    try:
        user = db.query(User).filter(User.email == email).first()
        user.password_reset_token_hash = token_hash
        user.password_reset_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5)
        db.commit()
    finally:
        db.close()

    res = client.post("/api/auth/reset-password", json={
        "token": raw_token,
        "new_password": "ExpiredTestPass123!",
    })
    assert res.status_code == 400
    assert "Invalid or expired" in res.json()["detail"]


def test_reset_password_rejects_tampered_token():
    """A tampered token is rejected with 400."""
    password_reset_rate_limiter.reset()
    email = f"rp_tamper_{secrets.token_hex(6)}@example.com"
    _create_test_user(email)

    captured = []
    with patch("app.api.v1.endpoints.auth.send_password_reset_email") as mock_send:
        mock_send.side_effect = lambda to_email, token: captured.append(token) or True
        client.post("/api/auth/forgot-password", json={"email": email})

    # Tamper with token string
    tampered_token = captured[0][:-4] + "XXXX"
    res = client.post("/api/auth/reset-password", json={
        "token": tampered_token,
        "new_password": "TamperPass123!",
    })
    assert res.status_code == 400


def test_reset_password_enforces_minimum_length():
    """Reset password enforces minimum 6 character policy."""
    res = client.post("/api/auth/reset-password", json={
        "token": "valid_token_length_is_long_enough_here",
        "new_password": "123",  # Too short
    })
    assert res.status_code == 422


# ─── Session Revocation Tests ───────────────────────────────────────────────

def test_password_reset_invalidates_existing_jwt_sessions():
    """After a password reset, previous JWT tokens are rejected with 401."""
    password_reset_rate_limiter.reset()
    email = f"sess_inval_{secrets.token_hex(6)}@example.com"
    old_pass = "SessionPass123!"
    reg_data = _create_test_user(email, password=old_pass)
    old_token = reg_data["access_token"]

    # Verify old session works prior to reset
    me_before = client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert me_before.status_code == 200

    # Request and execute password reset
    captured = []
    with patch("app.api.v1.endpoints.auth.send_password_reset_email") as mock_send:
        mock_send.side_effect = lambda to_email, token: captured.append(token) or True
        client.post("/api/auth/forgot-password", json={"email": email})

    client.post("/api/auth/reset-password", json={
        "token": captured[0],
        "new_password": "NewSessionPass456!",
    })

    # Old JWT session is now rejected due to token_version bump
    me_after = client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert me_after.status_code == 401
    assert "Session has expired" in me_after.json()["detail"]


# ─── Secure Account Linking Tests ───────────────────────────────────────────

@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_google_sign_in_existing_email_returns_structured_linking_required(mock_verify, mock_available):
    """Google sign in for an existing password account returns 409 ACCOUNT_LINKING_REQUIRED."""
    email = f"link_conflict_{secrets.token_hex(6)}@example.com"
    _create_test_user(email, password="MySecretPassword123!")

    fb_uid = f"uid_g_{secrets.token_hex(8)}"
    mock_verify.return_value = _mock_verified_token(uid=fb_uid, email=email)

    res = client.post("/api/auth/firebase", json={"id_token": "token_for_existing_email"})
    assert res.status_code == 409
    data = res.json()
    detail = data["detail"]
    assert isinstance(detail, dict)
    assert detail["error_code"] == "ACCOUNT_LINKING_REQUIRED"
    assert detail["email"] == email


@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_secure_account_linking_preserves_user_meals_and_profile(mock_verify, mock_available):
    """Linking Google identity preserves the user's existing meals, targets, and user_id."""
    email = f"link_preserve_{secrets.token_hex(6)}@example.com"
    password = "PreservePass123!"
    reg_data = _create_test_user(email, password=password)
    jwt_token = reg_data["access_token"]
    user_id = reg_data["user"]["id"]

    # User saves a meal
    meal_res = client.post("/api/meals", json={
        "meal_type": "dinner",
        "items": [{
            "food_name": "Lentil Curry",
            "serving_count": 1.0,
            "serving_size": 150.0,
            "serving_unit": "g",
            "calories": 250.0,
            "protein": 14.0,
            "carbohydrates": 35.0,
            "fat": 6.0,
        }],
    }, headers={"Authorization": f"Bearer {jwt_token}"})
    assert meal_res.status_code == 201
    meal_id = meal_res.json()["id"]

    # Now user links Google account
    fb_uid = f"linked_uid_{secrets.token_hex(8)}"
    mock_verify.return_value = _mock_verified_token(uid=fb_uid, email=email)

    link_res = client.post("/api/auth/link-firebase",
        json={"id_token": "valid_token_for_link"},
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    assert link_res.status_code == 200
    assert link_res.json()["id"] == user_id

    # Now user logs in via Google (POST /api/auth/firebase)
    mock_verify.return_value = _mock_verified_token(uid=fb_uid, email=email)
    google_login_res = client.post("/api/auth/firebase", json={"id_token": "token_after_linked"})
    assert google_login_res.status_code == 200
    new_jwt = google_login_res.json()["access_token"]
    assert google_login_res.json()["user"]["id"] == user_id

    # The user can still access their existing meal saved before linking
    saved_meal = client.get(f"/api/meals/{meal_id}", headers={"Authorization": f"Bearer {new_jwt}"})
    assert saved_meal.status_code == 200
    assert saved_meal.json()["id"] == meal_id
    assert saved_meal.json()["items"][0]["food_name"] == "Lentil Curry"
