# =============================================================================
# CloudMind AI – tests/conftest.py
#
# Pytest configuration file. Makes Python find the backend/ modules when
# tests are run from the project root or the tests/ directory.
# =============================================================================

import sys
import os

# Add the backend directory to Python's module search path so that
# `from app import app` and similar imports work inside test files.
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, os.path.abspath(BACKEND_DIR))
