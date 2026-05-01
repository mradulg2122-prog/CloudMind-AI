# =============================================================================
# CloudMind AI – backend/services/__init__.py
#
# Services Package Exports
# ─────────────────────────
# Centralizes all service imports for clean usage across the application.
#
# Usage:
#   from services import explain_service, report_service, rbac, logging_service
#   from services.health_service import HealthService
#   from services.sanitization_service import sanitize_string
#   from services.task_queue import task_queue
#   from services.model_registry import model_registry
# =============================================================================

from services import (
    explain_service,
    report_service,
    rbac,
    logging_service,
)

# Lazy imports to avoid circular dependencies at package load time
# Use direct module imports in dependent files instead.

__all__ = [
    "explain_service",
    "report_service",
    "rbac",
    "logging_service",
    # Available via direct import:
    # from services.health_service import HealthService
    # from services.sanitization_service import sanitize_string, sanitize_dict
    # from services.task_queue import task_queue
    # from services.model_registry import model_registry
]
