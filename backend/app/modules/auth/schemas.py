import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Password = Field(min_length=8, max_length=128)


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Password


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetConfirmIn(BaseModel):
    token: str = Field(max_length=200)
    password: str = Password


class DeleteAccountIn(BaseModel):
    confirm: Literal["DELETE"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    avatar_url: str | None
    email_verified_at: datetime | None
    has_password: bool
    created_at: datetime
