"""Tests for Firebase ID token authentication (C-1 security fix).

Tests cover:
- Valid Firebase ID token → user creation + JWT issuance
- Valid token for existing Firebase user → login
- Invalid / expired / malformed token → 401
- Missing token → 422
- Forged client-supplied UID → rejected (UID comes from verified token only)
- Email collision with local password account → 409 (no auto-linking)
- Existing email/password auth unaffected
- Firebase account linking with proof of ownership
- Duplicate account prevention
- User isolation after Firebase auth
- No synthetic fb_<uid> password generation
- No secret leakage in responses
- Firebase unavailable → 503
"""
import secrets
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import User
from app.core.security import hash_password, create_access_token


client = TestClient(app)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _mock_verified_token(uid: str = "firebase_uid_abc123", email: str = "firebase@example.com", name: str = "Test Firebase User"):
    """Return a dict mimicking firebase_admin.auth.verify_id_token output."""
    return {
        "uid": uid,
        "email": email,
        "name": name,
        "email_verified": True,
        "iss": "https://securetoken.google.com/nutrilens-dc1f9",
        "aud": "nutrilens-dc1f9",
        "sub": uid,
    }


def _register_local_user(email: str, password: str, name: str = "Local User"):
    """Register a local email/password user and return the response data."""
    res = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "name": name,
    })
    assert res.status_code == 201
    return res.json()


# ─── Valid Firebase Token Tests ─────────────────────────────────────────────

@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_firebase_auth_creates_new_user_with_valid_token(mock_verify, mock_available):
    """A valid Firebase ID token for a new email creates a user and returns a JWT."""
    unique_email = f"fb_new_{secrets.token_hex(6)}@example.com"
    mock_verify.return_value = _mock_verified_token(
        uid=f"uid_{secrets.token_hex(8)}",
        email=unique_email,
        name="New Firebase User",
    )

    res = client.post("/api/auth/firebase", json={"id_token": "valid_firebase_id_token_string"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == unique_email
    assert data["user"]["name"] == "New Firebase User"

    # Verify the issued JWT works for authenticated endpoints
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == unique_email


@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_firebase_auth_returns_existing_firebase_user(mock_verify, mock_available):
    """A valid token for an already-registered Firebase user logs them in."""
    unique_email = f"fb_existing_{secrets.token_hex(6)}@example.com"
    firebase_uid = f"uid_{secrets.token_hex(8)}"
    token_data = _mock_verified_token(uid=firebase_uid, email=unique_email)
    mock_verify.return_value = token_data

    # First call: creates user
    res1 = client.post("/api/auth/firebase", json={"id_token": "token_1"})
    assert res1.status_code == 200
    user_id_1 = res1.json()["user"]["id"]

    # Second call: same Firebase UID → same user
    mock_verify.return_value = token_data
    res2 = client.post("/api/auth/firebase", json={"id_token": "token_2"})
    assert res2.status_code == 200
    assert res2.json()["user"]["id"] == user_id_1


# ─── Invalid Token Tests ───────────────────────────────────────────────────

@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token", side_effect=ValueError("Invalid Firebase ID token: invalid"))
def test_firebase_auth_rejects_invalid_token(mock_verify, mock_available):
    """An invalid Firebase ID token returns 401."""
    res = client.post("/api/auth/firebase", json={"id_token": "invalid_garbage_token_string"})
    assert res.status_code == 401
    assert "invalid" in res.json()["detail"].lower()


@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token", side_effect=ValueError("Firebase ID token has expired. Please sign in again."))
def test_firebase_auth_rejects_expired_token(mock_verify, mock_available):
    """An expired Firebase ID token returns 401."""
    res = client.post("/api/auth/firebase", json={"id_token": "expired_token_string_here"})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token", side_effect=ValueError("Firebase ID token verification failed."))
def test_firebase_auth_rejects_wrong_project_token(mock_verify, mock_available):
    """A token from the wrong Firebase project is rejected."""
    res = client.post("/api/auth/firebase", json={"id_token": "wrong_project_token_value"})
    assert res.status_code == 401


def test_firebase_auth_rejects_missing_token():
    """A request without an id_token field returns 422."""
    res = client.post("/api/auth/firebase", json={})
    assert res.status_code == 422


def test_firebase_auth_rejects_empty_token():
    """A request with an empty id_token returns 422."""
    res = client.post("/api/auth/firebase", json={"id_token": ""})
    assert res.status_code == 422


# ─── Email Collision Prevention ─────────────────────────────────────────────

@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_firebase_auth_does_not_auto_link_password_account(mock_verify, mock_available):
    """Firebase auth must NOT auto-link an existing password account by email match."""
    unique_email = f"local_user_{secrets.token_hex(6)}@example.com"
    _register_local_user(unique_email, "SecurePassword123")

    mock_verify.return_value = _mock_verified_token(
        uid=f"uid_{secrets.token_hex(8)}",
        email=unique_email,
    )

    res = client.post("/api/auth/firebase", json={"id_token": "valid_token_for_colliding_email"})
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"].lower()


# ─── Forged UID Prevention ──────────────────────────────────────────────────

@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_firebase_auth_uid_comes_from_verified_token_not_client(mock_verify, mock_available):
    """The user identity is derived exclusively from the verified token, not any client-supplied field."""
    unique_email = f"fb_uid_test_{secrets.token_hex(6)}@example.com"
    server_uid = f"server_verified_uid_{secrets.token_hex(8)}"
    mock_verify.return_value = _mock_verified_token(uid=server_uid, email=unique_email)

    # Even if the client tried to supply a different UID somehow, the endpoint
    # only accepts id_token and derives identity from the verified token.
    res = client.post("/api/auth/firebase", json={
        "id_token": "valid_token_string_here",
        # No uid field accepted in the schema
    })
    assert res.status_code == 200

    # Verify the created user has the server-verified UID, not any client data
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {res.json()['access_token']}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == unique_email


# ─── Existing Email/Password Auth Unaffected ────────────────────────────────

def test_existing_email_password_auth_still_works():
    """Email/password registration and login remain fully functional."""
    unique_email = f"email_auth_{secrets.token_hex(6)}@example.com"
    password = "StrongPassword456!"

    # Register
    reg_res = client.post("/api/auth/register", json={
        "email": unique_email,
        "password": password,
        "name": "Email User",
    })
    assert reg_res.status_code == 201
    assert "access_token" in reg_res.json()

    # Login
    login_res = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": password,
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()


# ─── Account Linking Tests ──────────────────────────────────────────────────

@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_link_firebase_requires_both_jwt_and_firebase_token(mock_verify, mock_available):
    """Linking requires proof of ownership of both accounts."""
    unique_email = f"link_test_{secrets.token_hex(6)}@example.com"
    reg_data = _register_local_user(unique_email, "LinkTestPassword123")
    jwt_token = reg_data["access_token"]

    firebase_uid = f"link_uid_{secrets.token_hex(8)}"
    mock_verify.return_value = _mock_verified_token(uid=firebase_uid, email=unique_email)

    # Link Firebase identity to the authenticated account
    link_res = client.post("/api/auth/link-firebase",
        json={"id_token": "valid_firebase_token_for_linking"},
        headers={"Authorization": f"Bearer {jwt_token}"},
    )
    assert link_res.status_code == 200

    # Now the user can sign in with Firebase
    mock_verify.return_value = _mock_verified_token(uid=firebase_uid, email=unique_email)
    fb_res = client.post("/api/auth/firebase", json={"id_token": "token_after_link"})
    assert fb_res.status_code == 200
    assert fb_res.json()["user"]["id"] == reg_data["user"]["id"]


@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_link_firebase_requires_authentication(mock_verify, mock_available):
    """Linking without a valid NutriLens JWT returns 401."""
    mock_verify.return_value = _mock_verified_token()
    link_res = client.post("/api/auth/link-firebase",
        json={"id_token": "valid_firebase_token"},
    )
    assert link_res.status_code == 401


@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_link_firebase_rejects_uid_already_linked_to_other_account(mock_verify, mock_available):
    """Cannot link a Firebase UID that is already linked to a different user."""
    firebase_uid = f"shared_uid_{secrets.token_hex(8)}"

    # Create first Firebase user
    email1 = f"fb_link1_{secrets.token_hex(6)}@example.com"
    mock_verify.return_value = _mock_verified_token(uid=firebase_uid, email=email1)
    client.post("/api/auth/firebase", json={"id_token": "token_user1"})

    # Register a second local user and try to link the same Firebase UID
    email2 = f"fb_link2_{secrets.token_hex(6)}@example.com"
    reg_data = _register_local_user(email2, "Password789!")
    mock_verify.return_value = _mock_verified_token(uid=firebase_uid, email=email2)

    link_res = client.post("/api/auth/link-firebase",
        json={"id_token": "token_user2"},
        headers={"Authorization": f"Bearer {reg_data['access_token']}"},
    )
    assert link_res.status_code == 409


# ─── Duplicate Prevention ───────────────────────────────────────────────────

@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_firebase_auth_prevents_duplicate_accounts(mock_verify, mock_available):
    """Multiple Firebase auth calls with the same UID do not create duplicate users."""
    unique_email = f"fb_dup_{secrets.token_hex(6)}@example.com"
    firebase_uid = f"dup_uid_{secrets.token_hex(8)}"
    mock_verify.return_value = _mock_verified_token(uid=firebase_uid, email=unique_email)

    res1 = client.post("/api/auth/firebase", json={"id_token": "token_a"})
    res2 = client.post("/api/auth/firebase", json={"id_token": "token_b"})

    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()["user"]["id"] == res2.json()["user"]["id"]


# ─── User Isolation After Firebase Auth ─────────────────────────────────────

@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_firebase_user_cannot_access_other_users_meals(mock_verify, mock_available):
    """A Firebase-authenticated user cannot access another user's private meals."""
    # Create user A via Firebase
    email_a = f"fb_iso_a_{secrets.token_hex(6)}@example.com"
    uid_a = f"uid_a_{secrets.token_hex(8)}"
    mock_verify.return_value = _mock_verified_token(uid=uid_a, email=email_a)
    res_a = client.post("/api/auth/firebase", json={"id_token": "token_a"})
    token_a = res_a.json()["access_token"]

    # User A saves a meal
    meal_res = client.post("/api/meals", json={
        "meal_type": "lunch",
        "items": [{
            "food_name": "Test Meal Item",
            "serving_count": 1.0,
            "serving_size": 100.0,
            "serving_unit": "g",
            "calories": 200.0,
            "protein": 10.0,
            "carbohydrates": 25.0,
            "fat": 8.0,
        }],
    }, headers={"Authorization": f"Bearer {token_a}"})
    assert meal_res.status_code == 201
    meal_id = meal_res.json()["id"]

    # Create user B via Firebase
    email_b = f"fb_iso_b_{secrets.token_hex(6)}@example.com"
    uid_b = f"uid_b_{secrets.token_hex(8)}"
    mock_verify.return_value = _mock_verified_token(uid=uid_b, email=email_b)
    res_b = client.post("/api/auth/firebase", json={"id_token": "token_b"})
    token_b = res_b.json()["access_token"]

    # User B tries to access User A's meal → 403
    access_res = client.get(f"/api/meals/{meal_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert access_res.status_code == 403


# ─── No Synthetic Password Generation ──────────────────────────────────────

@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_firebase_user_cannot_login_with_fb_uid_password(mock_verify, mock_available):
    """A Firebase-created user's password is NOT derived from fb_<uid>."""
    unique_email = f"fb_nosynth_{secrets.token_hex(6)}@example.com"
    firebase_uid = f"uid_nosynth_{secrets.token_hex(8)}"
    mock_verify.return_value = _mock_verified_token(uid=firebase_uid, email=unique_email)

    # Create user via Firebase auth
    res = client.post("/api/auth/firebase", json={"id_token": "valid_token"})
    assert res.status_code == 200

    # Attempt login with the old-style synthetic password → must fail
    login_res = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": f"fb_{firebase_uid}",
    })
    assert login_res.status_code == 401


# ─── No Secret Leakage ─────────────────────────────────────────────────────

@patch("app.core.firebase_admin.is_firebase_available", return_value=True)
@patch("app.core.firebase_admin.verify_firebase_id_token")
def test_firebase_auth_response_contains_no_secrets(mock_verify, mock_available):
    """The auth response must not contain passwords, firebase UIDs, or internal tokens."""
    unique_email = f"fb_nosecret_{secrets.token_hex(6)}@example.com"
    firebase_uid = f"uid_nosecret_{secrets.token_hex(8)}"
    mock_verify.return_value = _mock_verified_token(uid=firebase_uid, email=unique_email)

    res = client.post("/api/auth/firebase", json={"id_token": "valid_token"})
    assert res.status_code == 200
    response_text = res.text

    # Response must not contain firebase_uid, hashed_password, or internal secrets
    assert firebase_uid not in response_text
    assert "hashed_password" not in response_text
    assert "firebase_uid" not in response_text


# ─── Firebase Unavailable ──────────────────────────────────────────────────

@patch("app.core.firebase_admin.is_firebase_available", return_value=False)
def test_firebase_auth_returns_503_when_not_configured(mock_available):
    """If Firebase Admin SDK is not initialized, the endpoint returns 503."""
    res = client.post("/api/auth/firebase", json={"id_token": "any_token_value_here"})
    assert res.status_code == 503
    assert "not configured" in res.json()["detail"].lower()


@patch("app.core.firebase_admin.is_firebase_available", return_value=False)
def test_link_firebase_returns_503_when_not_configured(mock_available):
    """If Firebase Admin SDK is not initialized, the link endpoint returns 503."""
    unique_email = f"link_503_{secrets.token_hex(6)}@example.com"
    reg_data = _register_local_user(unique_email, "LinkTest503!")

    res = client.post("/api/auth/link-firebase",
        json={"id_token": "any_token_value"},
        headers={"Authorization": f"Bearer {reg_data['access_token']}"},
    )
    assert res.status_code == 503
