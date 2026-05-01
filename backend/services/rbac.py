# =============================================================================
# CloudMind AI – backend/services/rbac.py
#
# Role-Based Access Control (RBAC) Service
# ─────────────────────────────────────────
# Defines roles, permissions, and FastAPI dependency functions for
# enforcing authorization on protected endpoints.
#
# Roles:
#   viewer  – read-only access (view predictions, analytics, history)
#   user    – standard user (run predictions, export data)
#   admin   – full access (retrain model, manage users, view all users' data)
#
# Usage:
#   from services.rbac import require_role, Role
#
#   @app.get("/admin/users")
#   def list_all_users(current_user: User = Depends(require_role(Role.ADMIN))):
#       ...
# =============================================================================

from enum import Enum
from typing import Callable
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db, User
from auth import get_current_user


class Role(str, Enum):
    """User roles in ascending privilege order."""
    VIEWER = "viewer"
    USER   = "user"
    ADMIN  = "admin"


# Role hierarchy — higher index = more privilege
_ROLE_HIERARCHY = [Role.VIEWER, Role.USER, Role.ADMIN]


def _role_rank(role: str) -> int:
    """Return numeric rank of a role string (higher = more privilege)."""
    try:
        return _ROLE_HIERARCHY.index(Role(role))
    except (ValueError, KeyError):
        return 0  # unknown role = lowest rank


def require_role(minimum_role: Role) -> Callable:
    """
    FastAPI dependency factory that enforces a minimum role requirement.

    Parameters
    ----------
    minimum_role : Role — the minimum role required to access the endpoint

    Returns
    -------
    A FastAPI dependency function that:
      1. Validates the JWT (via get_current_user)
      2. Checks user.role >= minimum_role in the hierarchy
      3. Raises 403 Forbidden if insufficient privileges

    Example
    -------
    @app.delete("/admin/users/{user_id}")
    def delete_user(
        user_id      : int,
        current_user : User = Depends(require_role(Role.ADMIN)),
        db           : Session = Depends(get_db),
    ):
        ...
    """
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        user_role = getattr(current_user, "role", Role.USER)
        if _role_rank(user_role) < _role_rank(minimum_role):
            raise HTTPException(
                status_code = status.HTTP_403_FORBIDDEN,
                detail      = (
                    f"Access denied. Required role: '{minimum_role.value}', "
                    f"your role: '{user_role}'."
                ),
            )
        return current_user
    return dependency


def is_admin(current_user: User = Depends(get_current_user)) -> User:
    """Shorthand dependency: require admin role."""
    return require_role(Role.ADMIN)(current_user)


def is_user_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Shorthand dependency: require user or admin role."""
    return require_role(Role.USER)(current_user)
