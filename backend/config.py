"""
config.py — Application configuration for NetVisSearch.

Loads settings from environment variables (via .env) at import time.
All downstream modules should import from here rather than reading os.environ directly.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Load .env file (silently ignored if it doesn't exist)
load_dotenv()


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _env_int(key: str, default: int) -> int:
    return int(os.environ.get(key, default))


def _env_bool(key: str, *, true_value: str) -> bool:
    return os.environ.get(key, "").strip().lower() == true_value.lower()


def _env_list(key: str, default: str = "") -> list[str]:
    raw = os.environ.get(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# ── App ──────────────────────────────────────────────────────────────────────
APP_ENV: str = _env("APP_ENV", "development")
APP_PORT: int = _env_int("APP_PORT", 8000)
SECRET_KEY: str = _env("SECRET_KEY", "change-me-to-a-random-64-char-string")
IS_PRODUCTION: bool = APP_ENV == "production"

# ── Storage ──────────────────────────────────────────────────────────────────
STORAGE_BACKEND: str = _env("STORAGE_BACKEND", "local")   # 'local' | 's3'
LOCAL_UPLOAD_DIR: Path = Path(_env("LOCAL_UPLOAD_DIR", "./data/uploads"))

# ── AWS (only needed when STORAGE_BACKEND='s3') ───────────────────────────
AWS_ACCESS_KEY_ID: str = _env("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY: str = _env("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION: str = _env("AWS_REGION", "ap-south-1")
S3_BUCKET_NAME: str = _env("S3_BUCKET_NAME", "")

# ── Database ─────────────────────────────────────────────────────────────────
DB_BACKEND: str = _env("DB_BACKEND", "duckdb")            # 'duckdb' | 'postgres'
DUCKDB_PATH: str = _env("DUCKDB_PATH", "./netvis.duckdb")

# ── ML Models ─────────────────────────────────────────────────────────────────
EMBEDDING_MODEL: str = _env("EMBEDDING_MODEL", "jinaai/jina-clip-v2")
EMBEDDING_DIM: int = _env_int("EMBEDDING_DIM", 512)
SPACY_MODEL: str = _env("SPACY_MODEL", "en_core_web_sm")
HF_CACHE_DIR: Path = Path(_env("HF_CACHE_DIR", "./model_cache"))

# ── Search ───────────────────────────────────────────────────────────────────
DEFAULT_TOP_K: int = _env_int("DEFAULT_TOP_K", 10)

# ── CORS ─────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS: list[str] = _env_list(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:3000",
)

# ── Bootstrap: ensure required directories exist ──────────────────────────────
LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
HF_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ── Tell Hugging Face / Transformers to use our cache dir ─────────────────────
os.environ["TRANSFORMERS_CACHE"] = str(HF_CACHE_DIR)
# Also set HF_HOME for newer versions of the hub library
os.environ["HF_HOME"] = str(HF_CACHE_DIR)
