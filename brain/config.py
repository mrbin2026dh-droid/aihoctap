"""Đọc cấu hình từ tệp .env (cùng thư mục chạy) hoặc biến môi trường."""
from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path


def load_env(path: str | os.PathLike = ".env") -> dict[str, str]:
    """Đọc tệp KEY=VALUE (bỏ dòng trống, dòng #). Biến môi trường thật được ưu tiên."""
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


KEYS = ("FB_URL", "FB_SECRET", "WORKER_URL", "BRAIN_KEY", "SHEET_URL", "SHEET_BRAIN_KEY",
        "GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_URL", "DB_PATH", "TZ_OFFSET_HOURS")


@dataclass
class Config:
    fb_url: str
    fb_secret: str
    worker_url: str = ""
    brain_key: str = ""
    sheet_url: str = ""
    sheet_brain_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    gemini_url: str = "https://generativelanguage.googleapis.com/v1beta/models"
    db_path: str = "brain.sqlite3"
    tz_offset_hours: int = 7

    @classmethod
    def from_env(cls, path: str | os.PathLike = ".env") -> "Config":
        e = load_env(path)
        missing = [k for k in ("FB_URL", "FB_SECRET") if not e.get(k)]
        if missing:
            raise SystemExit("Thiếu cấu hình: " + ", ".join(missing) + " (xem brain/.env.example)")
        return cls(
            fb_url=e["FB_URL"].rstrip("/"), fb_secret=e["FB_SECRET"],
            worker_url=e.get("WORKER_URL", "").rstrip("/"), brain_key=e.get("BRAIN_KEY", ""),
            sheet_url=e.get("SHEET_URL", ""), sheet_brain_key=e.get("SHEET_BRAIN_KEY", ""),
            gemini_api_key=e.get("GEMINI_API_KEY", ""), gemini_model=e.get("GEMINI_MODEL") or "gemini-3.5-flash",
            gemini_url=(e.get("GEMINI_URL") or "https://generativelanguage.googleapis.com/v1beta/models").rstrip("/"),
            db_path=e.get("DB_PATH") or "brain.sqlite3", tz_offset_hours=int(e.get("TZ_OFFSET_HOURS") or 7),
        )
