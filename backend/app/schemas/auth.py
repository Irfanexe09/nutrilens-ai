from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UserRegister(BaseModel):
    email: str = Field(
        ...,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        description="Valid email address",
    )
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    name: Optional[str] = Field(None, max_length=100)


class UserLogin(BaseModel):
    email: str = Field(
        ...,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        description="Valid email address",
    )
    password: str = Field(...)


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class FirebaseAuthRequest(BaseModel):
    """Request body for Firebase ID token authentication."""
    id_token: str = Field(
        ...,
        min_length=1,
        description="Firebase ID token obtained from Firebase client SDK",
    )


class FirebaseLinkRequest(BaseModel):
    """Request body for linking a Firebase identity to an existing backend account."""
    id_token: str = Field(
        ...,
        min_length=1,
        description="Firebase ID token to link to the current authenticated account",
    )


class ForgotPasswordRequest(BaseModel):
    """Request body to initiate password reset email."""
    email: str = Field(
        ...,
        pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        description="Registered account email address",
    )


class ResetPasswordRequest(BaseModel):
    """Request body to execute a password reset using single-use token."""
    token: str = Field(
        ...,
        min_length=16,
        description="Single-use password reset token received via email",
    )
    new_password: str = Field(
        ...,
        min_length=6,
        description="New password (minimum 6 characters)",
    )


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str

