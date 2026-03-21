"""Load ``.env`` from the project root (next to ``pyproject.toml``) or current directory."""

from __future__ import annotations

import os
from pathlib import Path


def project_root() -> Path:
    """Directory that contains ``pyproject.toml`` (repo root when installed editable)."""
    return Path(__file__).resolve().parent.parent.parent


def load_dotenv_config() -> None:
    """Load ``.env`` if ``python-dotenv`` is installed. First match wins."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for env_path in (project_root() / ".env", Path.cwd() / ".env"):
        if env_path.is_file():
            load_dotenv(env_path)
            return


def invoice_env() -> str:
    """Deployment label: dev, test, staging, prod (``INVOICE_ENV``)."""
    return (os.environ.get("INVOICE_ENV") or "dev").strip().lower()
