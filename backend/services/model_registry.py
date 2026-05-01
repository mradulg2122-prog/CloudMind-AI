# =============================================================================
# CloudMind AI – backend/services/model_registry.py
#
# ML Model Version Registry
# ──────────────────────────
# Tracks trained model versions, metadata, and supports rollback.
#
# Features:
#   - Register new model versions with metadata
#   - Load specific model version by ID
#   - Roll back to a previous version
#   - List all available versions
#   - Store/retrieve model_metadata.json
#
# Usage:
#   from services.model_registry import ModelRegistry
#   registry = ModelRegistry()
#   version_id = registry.register_model("v2.0.0", model_path, metrics)
#   model      = registry.load_version(version_id)
# =============================================================================

from __future__ import annotations

import json
import logging
import os
import shutil
import time
from datetime import datetime, timezone
from typing import Any, Optional

import joblib

logger = logging.getLogger("cloudmind.model_registry")

# ── File paths ─────────────────────────────────────────────────────────────────
_BACKEND_DIR    = os.path.dirname(os.path.dirname(__file__))
_BACKUPS_DIR    = os.path.join(_BACKEND_DIR, "model_backups")
_METADATA_FILE  = os.path.join(_BACKEND_DIR, "..", "model_metadata.json")
_CURRENT_MODEL  = os.path.join(_BACKEND_DIR, "cloudmind_workload_model.joblib")

os.makedirs(_BACKUPS_DIR, exist_ok=True)


class ModelRegistry:
    """
    Lightweight file-based model version registry.

    Model versions are stored as:
        backend/model_backups/model_v{YYYYMMDD_HHMMSS}.joblib

    Metadata is persisted to:
        model_metadata.json (at project root)

    Structure of model_metadata.json:
    {
        "versions": [
            {
                "version_id"  : "v20240101_120000",
                "version_label": "v1.0.0",
                "path"        : "backend/model_backups/model_v20240101_120000.joblib",
                "registered_at": "2024-01-01T12:00:00Z",
                "is_current"  : true,
                "metrics"     : { "r2_score": 0.97, "mae": 15.2, ... },
                "description" : "Initial training run",
                "n_samples"   : 50000,
            }
        ],
        "current_version_id": "v20240101_120000"
    }
    """

    def __init__(self):
        self._metadata = self._load_metadata()

    # =========================================================================
    # PUBLIC API
    # =========================================================================

    def register_model(
        self,
        version_label: str,
        source_path  : str,
        metrics      : Optional[dict] = None,
        description  : str = "",
        n_samples    : int = 0,
    ) -> str:
        """
        Register a new model version.

        Steps:
        1. Copy model file to backups directory with versioned name
        2. Mark this version as current in metadata
        3. Un-mark previous current version
        4. Persist metadata to JSON

        Parameters
        ----------
        version_label : str  — human-readable label (e.g., "v2.0.0")
        source_path   : str  — path to the new model .joblib file
        metrics       : dict — evaluation metrics (r2, mae, rmse, etc.)
        description   : str  — optional description of changes
        n_samples     : int  — number of training samples used

        Returns
        -------
        version_id : str — unique version identifier (e.g., "v20240101_120000")
        """
        if not os.path.isfile(source_path):
            raise FileNotFoundError(f"Model file not found: {source_path}")

        ts         = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        version_id = f"v{ts}"
        dest_path  = os.path.join(_BACKUPS_DIR, f"model_{version_id}.joblib")

        # Copy to versioned backup
        shutil.copy2(source_path, dest_path)
        logger.info(f"[Registry] Model copied to: {dest_path}")

        # Mark previous versions as not current
        for v in self._metadata.get("versions", []):
            v["is_current"] = False

        # Add new version record
        new_version = {
            "version_id"   : version_id,
            "version_label": version_label,
            "path"         : dest_path,
            "registered_at": datetime.now(timezone.utc).isoformat(),
            "is_current"   : True,
            "metrics"      : metrics or {},
            "description"  : description,
            "n_samples"    : n_samples,
        }

        if "versions" not in self._metadata:
            self._metadata["versions"] = []

        self._metadata["versions"].append(new_version)
        self._metadata["current_version_id"] = version_id

        self._save_metadata()
        logger.info(
            f"[Registry] Registered model version '{version_label}' as {version_id}"
        )
        return version_id

    def load_version(self, version_id: str) -> Any:
        """
        Load and return a specific model version by its version_id.

        Parameters
        ----------
        version_id : str — e.g., "v20240101_120000"

        Returns
        -------
        Loaded scikit-learn model object.

        Raises
        ------
        ValueError  if version_id not found in registry.
        FileNotFoundError if model file missing from disk.
        """
        version = self._find_version(version_id)
        if not version:
            raise ValueError(
                f"Version '{version_id}' not found in registry. "
                f"Available: {self.list_versions()}"
            )

        path = version["path"]
        if not os.path.isfile(path):
            raise FileNotFoundError(
                f"Model file for version '{version_id}' missing: {path}"
            )

        model = joblib.load(path)
        logger.info(f"[Registry] Loaded model version '{version_id}' from: {path}")
        return model

    def rollback(self, version_id: str) -> str:
        """
        Roll back the active model to a previous version.

        Copies the versioned backup over the current active model file,
        then updates metadata to mark that version as current.

        Parameters
        ----------
        version_id : str — version to restore

        Returns
        -------
        version_id : str — confirmed restored version
        """
        version = self._find_version(version_id)
        if not version:
            raise ValueError(f"Rollback target '{version_id}' not found.")

        src = version["path"]
        if not os.path.isfile(src):
            raise FileNotFoundError(f"Rollback file missing: {src}")

        # Overwrite active model
        shutil.copy2(src, _CURRENT_MODEL)

        # Update metadata
        for v in self._metadata.get("versions", []):
            v["is_current"] = (v["version_id"] == version_id)

        self._metadata["current_version_id"] = version_id
        self._save_metadata()

        logger.warning(
            f"[Registry] Rollback completed — active model is now '{version_id}'"
        )
        return version_id

    def get_current_version(self) -> Optional[dict]:
        """Return metadata dict for the currently active model version."""
        current_id = self._metadata.get("current_version_id")
        if not current_id:
            return None
        return self._find_version(current_id)

    def list_versions(self) -> list[dict]:
        """Return all registered model versions, newest first."""
        versions = self._metadata.get("versions", [])
        return sorted(versions, key=lambda v: v.get("registered_at", ""), reverse=True)

    def delete_version(self, version_id: str, delete_file: bool = False) -> bool:
        """
        Remove a version entry from the registry.
        Optionally delete the backup file from disk.

        Cannot delete the currently active version.
        """
        current_id = self._metadata.get("current_version_id")
        if version_id == current_id:
            raise ValueError(
                f"Cannot delete the currently active version '{version_id}'. "
                "Roll back to another version first."
            )

        version = self._find_version(version_id)
        if not version:
            return False

        if delete_file and os.path.isfile(version["path"]):
            os.remove(version["path"])
            logger.info(f"[Registry] Deleted model file: {version['path']}")

        self._metadata["versions"] = [
            v for v in self._metadata.get("versions", [])
            if v["version_id"] != version_id
        ]
        self._save_metadata()
        logger.info(f"[Registry] Version '{version_id}' removed from registry")
        return True

    # =========================================================================
    # PRIVATE HELPERS
    # =========================================================================

    def _find_version(self, version_id: str) -> Optional[dict]:
        for v in self._metadata.get("versions", []):
            if v["version_id"] == version_id:
                return v
        return None

    def _load_metadata(self) -> dict:
        """Load metadata from JSON file, or return empty structure."""
        meta_path = os.path.normpath(_METADATA_FILE)
        if os.path.isfile(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError) as exc:
                logger.warning(f"[Registry] Failed to load metadata: {exc}")
        return {"versions": [], "current_version_id": None}

    def _save_metadata(self) -> None:
        """Persist metadata to JSON file."""
        meta_path = os.path.normpath(_METADATA_FILE)
        try:
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(self._metadata, f, indent=2, default=str)
        except OSError as exc:
            logger.error(f"[Registry] Failed to save metadata: {exc}")

    def refresh(self) -> None:
        """Reload metadata from disk (useful after external changes)."""
        self._metadata = self._load_metadata()


# ── Module-level singleton ────────────────────────────────────────────────────
model_registry = ModelRegistry()
