# =============================================================================
# CloudMind AI – auth.py
#
# Responsibilities:
#   - Password hashing and verification via bcrypt (passlib)
#   - JWT token creation and decoding (python-jose)
#   - FastAPI dependency: get_current_user — validates token on protected routes
#
# Protected routes must use:
#   current_user: User = Depends(get_current_user)
# =============================================================================

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, User

# ── Security configuration ────────────────────────────────────────────────────
# In production these should come from environment variables, never hard-coded.
SECRET_KEY      = os.getenv("CLOUDMIND_SECRET_KEY", "cloudmind-super-secret-key-change-in-prod")
ALGORITHM       = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # tokens expire after 1 hour

# ── Password hashing context ─────────────────────────────────────────────────
# We try bcrypt first (most secure). If passlib's bcrypt backend has
# issues (e.g. Python 3.14+ compatibility), sha256_crypt is used as fallback.
try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    # Quick smoke-test — if bcrypt is broken, this raises an error
    pwd_context.hash("test")
except Exception:
    # Fallback to sha256_crypt which works on all Python versions
    from passlib.context import CryptContext as CC
    pwd_context = CC(schemes=["sha256_crypt"], deprecated="auto")

# ── OAuth2 bearer token scheme ────────────────────────────────────────────────
# Points FastAPI to the /auth/login endpoint for the OpenAPI docs
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# =============================================================================
# PYDANTIC SCHEMAS  (request / response bodies for auth endpoints)
# =============================================================================

class RegisterRequest(BaseModel):
    """Body required to create a new account."""
    username : str
    email    : str
    password : str


class LoginRequest(BaseModel):
    """Body accepted for JSON-based login."""
    username : str
    password : str


class TokenResponse(BaseModel):
    """JWT token returned after successful login."""
    access_token : str
    token_type   : str = "bearer"


class TokenData(BaseModel):
    """Decoded payload stored inside the JWT."""
    username : Optional[str] = None


class UserOut(BaseModel):
    """Public user profile — never exposes the hashed password."""
    id         : int
    username   : str
    email      : str
    is_active  : bool
    created_at : datetime

    model_config = {"from_attributes": True}  # allow ORM → Pydantic conversion


# =============================================================================
# PASSWORD UTILITIES
# =============================================================================

def hash_password(plain_password: str) -> str:
    """Return the bcrypt hash of a plain-text password."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if the plain password matches the stored hash."""
    return pwd_context.verify(plain_password, hashed_password)


# =============================================================================
# JWT UTILITIES
# =============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a signed JWT access token.

    Parameters
    ----------
    data          : dict — payload to encode (must include 'sub' key)
    expires_delta : timedelta — how long until the token expires

    Returns
    -------
    str — signed JWT string
    """
    payload = data.copy()
    expire  = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> TokenData:
    """
    Decode and validate a JWT token.

    Raises HTTPException 401 if the token is invalid or expired.
    """
    try:
        payload  = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise ValueError("Token payload missing 'sub' field")
        return TokenData(username=username)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate token — please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# =============================================================================
# FASTAPI DEPENDENCY — inject authenticated user into route handlers
# =============================================================================

def get_current_user(
    token: str          = Depends(oauth2_scheme),
    db   : Session      = Depends(get_db),
) -> User:
    """
    FastAPI dependency that:
      1. Extracts the Bearer token from the Authorization header
      2. Decodes and validates the JWT
      3. Loads the corresponding User from the database
      4. Returns the User ORM object (or raises 401)

    Usage in a route:
        @app.post("/predict")
        def predict(
            telemetry    : TelemetryInput,
            current_user : User = Depends(get_current_user),
            db           : Session = Depends(get_db),
        ):
            ...
    """
    token_data = decode_token(token)

    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# =============================================================================
# DB HELPER FUNCTIONS  (used by route handlers in app.py)
# =============================================================================

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Fetch a user row by username. Returns None if not found."""
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Fetch a user row by email. Returns None if not found."""
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, username: str, email: str, plain_password: str) -> User:
    """
    Create a new user in the database with a bcrypt-hashed password.

    Raises ValueError if username/email is already taken.
    """
    if get_user_by_username(db, username):
        raise ValueError(f"Username '{username}' is already taken.")
    if get_user_by_email(db, email):
        raise ValueError(f"Email '{email}' is already registered.")

    new_user = User(
        username  = username,
        email     = email,
        hashed_pw = hash_password(plain_password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def authenticate_user(db: Session, username: str, plain_password: str) -> Optional[User]:
    """
    Check credentials and return the User if valid, else None.

    Used by the /auth/login endpoint before issuing a JWT.
    """
    user = get_user_by_username(db, username)
    if user is None:
        return None
    if not verify_password(plain_password, user.hashed_pw):
        return None
    return user
