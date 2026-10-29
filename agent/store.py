"""Bộ nhớ của agent (SQLite riêng, không khóa CSDL của Bộ não): tiêu chí chấm, điểm giáo viên sửa, nhật ký chạy.
Không lưu tên học sinh. Bài làm chỉ lưu ở bảng corrections khi giáo viên chủ động sửa điểm (làm ví dụ mẫu)."""
from __future__ import annotations
import hashlib
import json
import sqlite3
import threading
import time
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS rubric(h TEXT PRIMARY KEY, data TEXT, source TEXT, at INTEGER);
CREATE TABLE IF NOT EXISTS corrections(id INTEGER PRIMARY KEY AUTOINCREMENT, h TEXT, answer TEXT, score REAL, max REAL, note TEXT, at INTEGER);
CREATE INDEX IF NOT EXISTS ix_corr_h ON corrections(h);
CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, kind TEXT, ms INTEGER, model TEXT, votes INTEGER,
  score REAL, max REAL, spread REAL, review INTEGER, ok INTEGER, err TEXT);
"""


def qhash(question: str, guide: str, max_points: float) -> str:
    return hashlib.sha1(f"{question.strip()}\x1f{guide.strip()}\x1f{float(max_points):.2f}".encode("utf-8")).hexdigest()[:20]


class Store:
    def __init__(self, path: str):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.Lock()
        with self.lock, self.db:
            self.db.execute("PRAGMA journal_mode=WAL")
            self.db.executescript(SCHEMA)

    def close(self) -> None:
        self.db.close()

    def get_rubric(self, h: str) -> list[dict[str, Any]] | None:
        with self.lock:
            r = self.db.execute("SELECT data FROM rubric WHERE h=?", (h,)).fetchone()
        return json.loads(r["data"]) if r else None

    def put_rubric(self, h: str, items: list[dict[str, Any]], source: str) -> None:
        with self.lock, self.db:
            self.db.execute("INSERT OR REPLACE INTO rubric(h, data, source, at) VALUES(?,?,?,?)", (h, json.dumps(items, ensure_ascii=False), source, int(time.time())))

    def add_correction(self, h: str, answer: str, score: float, max_points: float, note: str = "") -> int:
        with self.lock, self.db:
            cur = self.db.execute("INSERT INTO corrections(h, answer, score, max, note, at) VALUES(?,?,?,?,?,?)",
                                  (h, answer[:3000], float(score), float(max_points), note[:300], int(time.time())))
            return int(cur.lastrowid)

    def corrections(self, h: str, limit: int = 30) -> list[dict[str, Any]]:
        with self.lock:
            rows = self.db.execute("SELECT answer, score, max, note FROM corrections WHERE h=? ORDER BY id DESC LIMIT ?", (h, limit)).fetchall()
        return [dict(r) for r in rows]

    def log_run(self, kind: str, ms: int, model: str = "", votes: int = 0, score: float | None = None, max_points: float | None = None,
                spread: float | None = None, review: bool = False, ok: bool = True, err: str = "") -> None:
        with self.lock, self.db:
            self.db.execute("INSERT INTO runs(at, kind, ms, model, votes, score, max, spread, review, ok, err) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                            (int(time.time()), kind, ms, model, votes, score, max_points, spread, int(review), int(ok), err[:200]))

    def stats(self, hours: int = 24) -> dict[str, Any]:
        since = int(time.time()) - hours * 3600
        with self.lock:
            r = self.db.execute("SELECT COUNT(*) n, SUM(ok) ok, SUM(review) review, AVG(ms) ms FROM runs WHERE at>=? AND kind='grade'", (since,)).fetchone()
            c = self.db.execute("SELECT COUNT(*) n FROM corrections").fetchone()
        return {"cham_24h": r["n"] or 0, "thanh_cong": r["ok"] or 0, "can_xem_lai": r["review"] or 0,
                "thoi_gian_tb_ms": round(r["ms"] or 0), "vi_du_giao_vien": c["n"] or 0}
