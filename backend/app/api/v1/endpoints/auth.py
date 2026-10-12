import secrets
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.auth import (
    UserRegister,
    UserLogin,
    UserResponse,
    TokenResponse,
    FirebaseAuthRequest,
    FirebaseLinkRequest,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.core import firebase_admin as fb_admin


def is_firebase_available() -> bool:
    return fb_admin.is_firebase_available()


def verify_firebase_id_token(id_token: str):
    return fb_admin.verify_firebase_id_token(id_token)

logger = logging.getLogger("nutrilens.auth")

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user account with secure PBKDF2-HMAC-SHA256 password hashing.
    Returns access token and user identity.
    """
    existing = db.query(User).filter(User.email == user_in.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists",
        )

    user = User(
        email=user_in.email.lower(),
        hashed_password=hash_password(user_in.password),
        name=user_in.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login_user(login_in: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user credentials and issue signed JWT access token.
    """
    user = db.query(User).filter(User.email == login_in.email.lower()).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/firebase", response_model=TokenResponse)
def authenticate_with_firebase(req: FirebaseAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate using a Firebase ID token verified server-side.

    Flow:
    1. Verifies the Firebase ID token cryptographically via Firebase Admin SDK.
    2. Extracts the verified Firebase UID and email from the token claims.
    3. Looks up an existing user by firebase_uid.
    4. If found, issues a NutriLens JWT for that user.
    5. If not found by UID, checks if the email is already registered.
    6. If email exists (local password account without firebase_uid), rejects
       the request to prevent unauthorized account linking.
    7. If no user exists, creates a new account linked to the Firebase identity.

    The frontend must never send a raw Firebase UID — identity is derived
    exclusively from the cryptographically verified token.
    """
    if not is_firebase_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not configured on this server.",
        )

    # Step 1: Verify the Firebase ID token server-side
    try:
        decoded_token = verify_firebase_id_token(req.id_token)
    except ValueError as e:
        logger.warning(f"Firebase token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Step 2: Extract verified identity from token claims
    firebase_uid: str = decoded_token["uid"]
    email: str = (decoded_token.get("email") or "").strip().lower()
    display_name: str = decoded_token.get("name") or decoded_token.get("display_name") or ""

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firebase account does not have an email address. Email is required for NutriLens.",
        )

    # Step 3: Look up by verified Firebase UID
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if user:
        # Existing Firebase-linked user — issue JWT
        token = create_access_token(subject=user.id)
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user=UserResponse.model_validate(user),
        )

    # Step 4: Check if email is already registered (local account)
    existing_by_email = db.query(User).filter(User.email == email).first()
    if existing_by_email:
        if existing_by_email.firebase_uid is None:
            # Email belongs to a local password account — do not auto-link
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An account with this email already exists with password authentication. "
                    "Please sign in with your email and password, then link your Google account "
                    "from your profile settings."
                ),
            )
        else:
            # Email exists with a different Firebase UID — should not happen, but handle safely
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email is associated with a different Firebase identity.",
            )

    # Step 5: Create new user linked to verified Firebase identity
    # Generate a cryptographically random password the user will never know.
    # This satisfies the NOT NULL constraint on hashed_password without creating
    # a predictable or guessable credential.
    random_password = secrets.token_urlsafe(64)
    user = User(
        email=email,
        hashed_password=hash_password(random_password),
        name=display_name or None,
        firebase_uid=firebase_uid,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        # Handle race condition: another request may have created the user concurrently
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        if not user:
            user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Account creation failed. Please try again.",
            )

    logger.info(f"New Firebase-authenticated user created: user_id={user.id}")
    token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/link-firebase", response_model=UserResponse)
def link_firebase_account(
    req: FirebaseLinkRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Link a Firebase identity to the current authenticated backend account.

    Requires:
    - A valid NutriLens JWT (proves ownership of the backend account)
    - A valid Firebase ID token (proves ownership of the Firebase identity)

    Both sides are cryptographically verified before linking.
    """
    if not is_firebase_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not configured on this server.",
        )

    # Verify the Firebase ID token
    try:
        decoded_token = verify_firebase_id_token(req.id_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Firebase token verification failed: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    firebase_uid: str = decoded_token["uid"]

    # Check if this Firebase UID is already linked to another account
    existing = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if existing and existing.id != user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This Firebase identity is already linked to a different account.",
        )

    if user.firebase_uid == firebase_uid:
        # Already linked to this identity
        return UserResponse.model_validate(user)

    if user.firebase_uid is not None and user.firebase_uid != firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Your account is already linked to a different Firebase identity.",
        )

    # Link the Firebase UID to the authenticated user
    user.firebase_uid = firebase_uid
    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Failed to link Firebase identity. It may already be linked to another account.",
        )

    logger.info(f"Firebase identity linked to user_id={user.id}")
    return UserResponse.model_validate(user)


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(user: User = Depends(get_current_user)):
    """
    Get current authenticated user identity.
    """
    return UserResponse.model_validate(user)
