# =============================================================================
# CloudMind AI – logger_config.py
#
# Centralized structured logging configuration.
#
# Usage anywhere in the project:
#   from logger_config import get_logger
#   logger = get_logger(__name__)
#   logger.info("Prediction complete", extra={"action": "SCALE UP"})
#
# Logs are written to:
#   - Console (stdout) — for development visibility
#   - logs/app.log     — persistent file for audit/debugging
# =============================================================================

import logging
import os
from logging.handlers import RotatingFileHandler

# ── Ensure the logs/ directory exists ────────────────────────────────────────
LOGS_DIR  = os.path.join(os.path.dirname(__file__), "..", "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

LOG_FILE  = os.path.join(LOGS_DIR, "app.log")

# ── Log format — structured, easy to parse ────────────────────────────────────
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)-30s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# ── Root logger setup (done ONCE) ─────────────────────────────────────────────
def _setup_root_logger():
    """
    Configure the root logger with:
      - StreamHandler  → prints to terminal
      - RotatingFileHandler → writes up to 10 MB per file, keeps 5 backups
    Called automatically when this module is imported.
    """
    root = logging.getLogger()
    if root.handlers:
        # Already configured — skip to avoid duplicate handlers
        return

    root.setLevel(logging.DEBUG)

    formatter = logging.Formatter(fmt=LOG_FORMAT, datefmt=DATE_FORMAT)

    # Console handler (INFO and above)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    # File handler (DEBUG and above, rotating)
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes    = 10 * 1024 * 1024,  # 10 MB per file
        backupCount = 5,
        encoding    = "utf-8",
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    root.addHandler(console_handler)
    root.addHandler(file_handler)


# Run setup immediately on import
_setup_root_logger()


def get_logger(name: str) -> logging.Logger:
    """
    Return a named logger that inherits from the configured root logger.

    Parameters
    ----------
    name : str — typically __name__ of the calling module

    Returns
    -------
    logging.Logger
    """
    return logging.getLogger(name)
