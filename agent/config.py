"""Cấu hình đọc từ .env hoặc biến môi trường (biến môi trường thật được ưu tiên)."""
from __future__ import annotations
import os
from dataclasses import dataclass, field
from pathlib import Path

KEYS = ("AGENT_KEY", "GEMINI_API_KEYS", "GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_FALLBACK_MODEL", "GEMINI_URL",
        "OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL", "AGENT_VOTES", "AGENT_CONCURRENCY", "AGENT_DB", "AGENT_PORT")


def load_env(path: str | os.PathLike = ".env") -> dict[str, str]:
    out: dict[str, str] = {}
    p = Path(path)
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    out.update({k: v for k, v in os.environ.items() if k in KEYS})
    return out


@dataclass
class Config:
    agent_key: str = ""
    gemini_keys: list[str] = field(default_factory=list)
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_fallback: str = ""
    gemini_url: str = "https://generativelanguage.googleapis.com/v1beta/models"
    openai_base_url: str = ""
    openai_api_key: str = ""
    openai_model: str = ""
    votes: int = 3
    concurrency: int = 4
    db_path: str = "agent.sqlite3"
    port: int = 8787

    @classmethod
    def from_env(cls, path: str | os.PathLike = ".env") -> "Config":
        e = load_env(path)
        keys = [k.strip() for k in (e.get("GEMINI_API_KEYS") or e.get("GEMINI_API_KEY") or "").split(",") if k.strip()]
        return cls(
            agent_key=e.get("AGENT_KEY", ""), gemini_keys=keys,
            gemini_model=e.get("GEMINI_MODEL") or "gemini-3.5-flash-lite", gemini_fallback=e.get("GEMINI_FALLBACK_MODEL", ""),
            gemini_url=(e.get("GEMINI_URL") or "https://generativelanguage.googleapis.com/v1beta/models").rstrip("/"),
            openai_base_url=(e.get("OPENAI_BASE_URL") or "").rstrip("/"), openai_api_key=e.get("OPENAI_API_KEY", ""), openai_model=e.get("OPENAI_MODEL", ""),
            votes=max(1, min(5, int(e.get("AGENT_VOTES") or 3))), concurrency=max(1, min(16, int(e.get("AGENT_CONCURRENCY") or 4))),
            db_path=e.get("AGENT_DB") or "agent.sqlite3", port=int(e.get("AGENT_PORT") or 8787),
        )
