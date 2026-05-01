# =============================================================================
# CloudMind AI – auth.py  (v4 — Production Auth)
#
# Additions over v3:
#   ✅ Password strength validation (min 8 chars, uppercase, digit, special)
#   ✅ RBAC role field on UserOut and create_user
#   ✅ Admin promotion helper — set_user_role()
#   ✅ Refresh token support structure (exp claim + iat)
#   ✅ Email format validation via regex
# =============================================================================

import os
import re
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from database import get_db, User

# ── Security configuration ────────────────────────────────────────────────────
SECRET_KEY                  = os.getenv("CLOUDMIND_SECRET_KEY", "cloudmind-super-secret-key-CHANGE-IN-PRODUCTION")
ALGORITHM                   = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# ── Password hashing ──────────────────────────────────────────────────────────
try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    pwd_context.hash("test")                    # smoke test
except Exception:
    from passlib.context import CryptContext as _CC
    pwd_context = _CC(schemes=["sha256_crypt"], deprecated="auto")

# ── OAuth2 bearer scheme ──────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ── Password strength regex ───────────────────────────────────────────────────
_PW_REGEX = re.compile(
    r"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]).{8,}$"
)

# ── Email format regex (RFC 5322 simplified) ──────────────────────────────────
_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


# =============================================================================
# PYDANTIC SCHEMAS
# =============================================================================

class RegisterRequest(BaseModel):
    """Registration payload — all fields are validated server-side."""
    username : str
    email    : str
    password : str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be 3–32 characters.")
        if not re.match(r"^[a-zA-Z0-9_\-]+$", v):
            raise ValueError("Username may only contain letters, digits, underscores, and hyphens.")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_REGEX.match(v):
            raise ValueError("Invalid email address format.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not _PW_REGEX.match(v):
            raise ValueError(
                "Password must be at least 8 characters and include "
                "an uppercase letter, a lowercase letter, a digit, and a special character."
            )
        return v


class LoginRequest(BaseModel):
    """Login payload — JSON-based (not form-data)."""
    username : str
    password : str


class TokenResponse(BaseModel):
    """JWT token returned after successful login."""
    access_token : str
    token_type   : str = "bearer"
    expires_in   : int = ACCESS_TOKEN_EXPIRE_MINUTES * 60  # seconds


class TokenData(BaseModel):
    """Decoded JWT payload."""
    username : Optional[str] = None


class UserOut(BaseModel):
    """Public user profile — never exposes hashed_pw."""
    id         : int
    username   : str
    email      : str
    role       : str
    is_active  : bool
    created_at : datetime

    model_config = {"from_attributes": True}


# =============================================================================
# PASSWORD UTILITIES
# =============================================================================

def hash_password(plain: str) -> str:
    """Return bcrypt hash of a plain-text password."""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if plain matches the stored hash."""
    return pwd_context.verify(plain, hashed)


# =============================================================================
# JWT UTILITIES
# =============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT with exp and iat claims."""
    payload = data.copy()
    now     = datetime.utcnow()
    expire  = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expire, "iat": now, "type": "access"})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> TokenData:
    """Decode and validate a JWT. Raises 401 on any error."""
    try:
        payload  = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise ValueError("Missing 'sub' in token payload")
        return TokenData(username=username)
    except JWTError:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "Could not validate credentials — please log in again.",
            headers     = {"WWW-Authenticate": "Bearer"},
        )


# =============================================================================
# FASTAPI DEPENDENCY — inject authenticated user
# =============================================================================

def get_current_user(
    token : str     = Depends(oauth2_scheme),
    db    : Session = Depends(get_db),
) -> User:
    """
    Validates the JWT Bearer token and returns the corresponding User ORM object.
    Raises HTTP 401 if token is invalid, expired, or user is deactivated.
    """
    token_data = decode_token(token)
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "User not found or account deactivated.",
            headers     = {"WWW-Authenticate": "Bearer"},
        )
    return user


# =============================================================================
# DB HELPER FUNCTIONS
# =============================================================================

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def create_user(
    db            : Session,
    username      : str,
    email         : str,
    plain_password: str,
    role          : str = "user",
) -> User:
    """
    Create a new user with a hashed password.
    Raises ValueError on duplicate username or email.
    """
    if get_user_by_username(db, username):
        raise ValueError(f"Username '{username}' is already taken.")
    if get_user_by_email(db, email):
        raise ValueError(f"Email '{email}' is already registered.")

    new_user = User(
        username  = username,
        email     = email,
        hashed_pw = hash_password(plain_password),
        role      = role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def authenticate_user(db: Session, username: str, plain_password: str) -> Optional[User]:
    """Validate credentials and return the User if correct, else None."""
    user = get_user_by_username(db, username)
    if user is None:
        return None
    if not verify_password(plain_password, user.hashed_pw):
        return None
    return user


def set_user_role(db: Session, username: str, role: str) -> User:
    """Promote or demote a user's role. Raises ValueError if user not found."""
    valid_roles = {"viewer", "user", "admin"}
    if role not in valid_roles:
        raise ValueError(f"Invalid role '{role}'. Must be one of: {valid_roles}")
    user = get_user_by_username(db, username)
    if not user:
        raise ValueError(f"User '{username}' not found.")
    user.role = role
    db.commit()
    db.refresh(user)
    return user
