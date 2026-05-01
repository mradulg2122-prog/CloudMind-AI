# =============================================================================
# CloudMind AI – backend/services/sanitization_service.py
#
# Input Sanitization & Validation Service
# ─────────────────────────────────────────
# Provides server-side sanitization to defend against:
#   - XSS (Cross-Site Scripting)
#   - SQL Injection pattern detection
#   - Path Traversal attacks
#   - Null byte injection
#   - Oversized payload detection
#   - Unicode normalization attacks
#
# Usage:
#   from services.sanitization_service import sanitize_string, sanitize_dict
#
#   clean = sanitize_string(user_input)
#   clean_dict = sanitize_dict(request_body)
# =============================================================================

from __future__ import annotations

import html
import re
import unicodedata
from typing import Any


# ── Dangerous pattern signatures ──────────────────────────────────────────────

# SQL injection patterns (case-insensitive)
_SQL_INJECTION_PATTERNS = re.compile(
    r"(union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set"
    r"|--\s*$|;\s*(drop|delete|truncate|alter)|xp_cmdshell|exec\s*\(|cast\s*\(|convert\s*\()",
    re.IGNORECASE,
)

# XSS attack patterns
_XSS_PATTERNS = re.compile(
    r"(<script[\s\S]*?>[\s\S]*?</script>|javascript\s*:|on\w+\s*=|"
    r"<\s*iframe|<\s*img[^>]+onerror|eval\s*\(|document\.cookie|window\.location)",
    re.IGNORECASE,
)

# Path traversal patterns
_PATH_TRAVERSAL_PATTERNS = re.compile(
    r"(\.\./|\.\.\\|%2e%2e%2f|%2e%2e/|\.\./|\.\.%2f)",
    re.IGNORECASE,
)

# Null byte injection
_NULL_BYTE_PATTERN = re.compile(r"\x00")

# Maximum string length for user inputs
_MAX_STRING_LENGTH = 4096


# =============================================================================
# PUBLIC API
# =============================================================================

def sanitize_string(value: str, max_length: int = _MAX_STRING_LENGTH) -> str:
    """
    Sanitize a single string input.

    Steps:
    1. Normalize unicode (NFC form — prevents homoglyph attacks)
    2. Strip null bytes
    3. HTML-escape dangerous characters
    4. Truncate to max_length
    5. Strip leading/trailing whitespace

    Parameters
    ----------
    value      : str — raw input to sanitize
    max_length : int — maximum allowed length (default: 4096)

    Returns
    -------
    Sanitized string.

    Raises
    ------
    ValueError if SQL injection, XSS, or path traversal patterns detected.
    """
    if not isinstance(value, str):
        return value

    # Step 1 — Unicode normalization
    value = unicodedata.normalize("NFC", value)

    # Step 2 — Remove null bytes
    value = _NULL_BYTE_PATTERN.sub("", value)

    # Step 3 — Detect malicious patterns BEFORE escaping
    _check_malicious_patterns(value)

    # Step 4 — HTML-escape special characters (< > & ' ")
    value = html.escape(value, quote=True)

    # Step 5 — Truncate
    value = value[:max_length]

    # Step 6 — Strip whitespace
    return value.strip()


def sanitize_dict(data: dict[str, Any], max_depth: int = 5) -> dict[str, Any]:
    """
    Recursively sanitize all string values in a dictionary.

    Parameters
    ----------
    data      : dict — input dictionary (e.g., request body)
    max_depth : int  — max recursion depth to prevent DoS

    Returns
    -------
    New dictionary with all strings sanitized.
    """
    return _sanitize_value(data, depth=0, max_depth=max_depth)


def check_sql_injection(value: str) -> bool:
    """
    Return True if the string contains SQL injection patterns.
    Use for logging/alerting (does NOT sanitize).
    """
    return bool(_SQL_INJECTION_PATTERNS.search(value))


def check_xss(value: str) -> bool:
    """
    Return True if the string contains XSS patterns.
    Use for logging/alerting (does NOT sanitize).
    """
    return bool(_XSS_PATTERNS.search(value))


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to prevent path traversal and injection.
    Keeps only alphanumeric characters, dots, underscores, and hyphens.
    """
    if not isinstance(filename, str):
        return "file"

    # Remove path traversal
    filename = re.sub(r"[/\\]", "", filename)
    filename = _NULL_BYTE_PATTERN.sub("", filename)

    # Keep only safe characters
    filename = re.sub(r"[^a-zA-Z0-9._\-]", "_", filename)

    # Prevent hidden files
    filename = filename.lstrip(".")

    return filename[:255] or "file"


def sanitize_username(username: str) -> str:
    """
    Sanitize a username — allows alphanumeric, underscores, hyphens only.
    Raises ValueError if pattern is invalid.
    """
    if not isinstance(username, str):
        raise ValueError("Username must be a string.")

    username = username.strip()
    if not re.match(r"^[a-zA-Z0-9_\-]{3,64}$", username):
        raise ValueError(
            "Username must be 3–64 characters and contain only "
            "letters, digits, underscores, and hyphens."
        )
    return username


# =============================================================================
# PRIVATE HELPERS
# =============================================================================

def _check_malicious_patterns(value: str) -> None:
    """
    Raise ValueError if the input contains known attack patterns.
    Called before HTML-escaping so patterns are detected in raw form.
    """
    if _SQL_INJECTION_PATTERNS.search(value):
        raise ValueError(
            "Input rejected: SQL injection pattern detected. "
            "Please avoid SQL keywords in your input."
        )
    if _XSS_PATTERNS.search(value):
        raise ValueError(
            "Input rejected: XSS pattern detected. "
            "Script tags and event handlers are not allowed."
        )
    if _PATH_TRAVERSAL_PATTERNS.search(value):
        raise ValueError(
            "Input rejected: Path traversal pattern detected."
        )


def _sanitize_value(value: Any, depth: int, max_depth: int) -> Any:
    """Recursively sanitize a value of any type."""
    if depth > max_depth:
        return value  # safety: don't recurse endlessly

    if isinstance(value, str):
        return sanitize_string(value)
    elif isinstance(value, dict):
        return {
            k: _sanitize_value(v, depth + 1, max_depth)
            for k, v in value.items()
        }
    elif isinstance(value, list):
        return [_sanitize_value(item, depth + 1, max_depth) for item in value]
    else:
        # Numeric, bool, None — return as-is
        return value
