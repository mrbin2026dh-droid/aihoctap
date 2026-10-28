"""Bộ nhớ dài hạn (SQLite): ảnh chụp mỗi ngày của năng lực, bài thi, đọc bài + nhật ký câu hỏi Gia sư.

Firebase chỉ giữ trạng thái MỚI NHẤT; bộ não giữ cả quá khứ → thấy được xu hướng tiến bộ / sa sút.
"""
from __future__ import annotations
import json
import sqlite3
from typing import Any, Iterable

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS students(ma TEXT PRIMARY KEY, ten TEXT, lop TEXT, updated TEXT);
CREATE TABLE IF NOT EXISTS mastery(day TEXT, ma TEXT, topic TEXT, ten TEXT, d REAL, n REAL, PRIMARY KEY(day, ma, topic));
CREATE TABLE IF NOT EXISTS exams(day TEXT, exam TEXT, title TEXT, mode TEXT, ma TEXT, diem REAL, tong REAL, dau REAL, best REAL, lan INTEGER, PRIMARY KEY(day, exam, ma));
CREATE TABLE IF NOT EXISTS reads(day TEXT, ma TEXT, lesson TEXT, pct REAL, PRIMARY KEY(day, ma, lesson));
CREATE TABLE IF NOT EXISTS questions(at INTEGER, ma TEXT, lop TEXT, course TEXT, lesson TEXT, q TEXT, blocked INTEGER, PRIMARY KEY(at, ma));
CREATE TABLE IF NOT EXISTS qbank(exam TEXT, qid TEXT, text TEXT, topic TEXT, answer TEXT, options TEXT, PRIMARY KEY(exam, qid));
CREATE TABLE IF NOT EXISTS answers(exam TEXT, ma TEXT, qid TEXT, chosen TEXT, PRIMARY KEY(exam, ma, qid));
CREATE TABLE IF NOT EXISTS study(day TEXT, ma TEXT, minutes INTEGER, PRIMARY KEY(day, ma));
CREATE TABLE IF NOT EXISTS reports(day TEXT, lop TEXT, md TEXT, facts TEXT, PRIMARY KEY(day, lop));
CREATE INDEX IF NOT EXISTS ix_mastery_ma ON mastery(ma, day);
CREATE INDEX IF NOT EXISTS ix_questions_lop ON questions(lop, at);
"""


def open_db(path: str) -> sqlite3.Connection:
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA)
    return db


def get_meta(db: sqlite3.Connection, k: str, default: str = "") -> str:
    r = db.execute("SELECT v FROM meta WHERE k=?", (k,)).fetchone()
    return r["v"] if r else default


def set_meta(db: sqlite3.Connection, k: str, v: str) -> None:
    db.execute("INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", (k, v))


def num(x: Any, d: float = 0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return d


def snapshot(db: sqlite3.Connection, day: str, data: dict[str, Any]) -> dict[str, int]:
    """Lưu ảnh chụp một ngày (ghi đè nếu chạy lại cùng ngày). data = các nhánh Firebase đã tải."""
    hs = data.get("thi_hs") or {}
    nl = data.get("nang_luc") or {}
    dr = data.get("doc_read") or {}
    bai = data.get("thi_bai") or {}
    nop = data.get("thi_nop") or {}
    de = data.get("thi_de") or {}
    with db:
        for k, s in hs.items():
            if isinstance(s, dict):
                db.execute("INSERT INTO students(ma, ten, lop, updated) VALUES(?,?,?,?) ON CONFLICT(ma) DO UPDATE SET ten=excluded.ten, lop=excluded.lop, updated=excluded.updated",
                           (k, str(s.get("ten") or k), str(s.get("lop") or ""), day))
        for tbl in ("mastery", "exams", "reads"):
            db.execute(f"DELETE FROM {tbl} WHERE day=?", (day,))
        n_m = n_e = n_r = 0
        for ma, rec in nl.items():
            for topic, v in ((rec or {}).get("topics") or {}).items():
                if isinstance(v, dict) and num(v.get("n")) > 0:
                    db.execute("INSERT INTO mastery VALUES(?,?,?,?,?,?)", (day, ma, topic, str(v.get("ten") or topic), num(v.get("d")), num(v.get("n"))))
                    n_m += 1
        for exam, by in nop.items():
            meta = bai.get(exam) or {}
            for ma, r in (by or {}).items():
                if isinstance(r, dict) and num(r.get("tong")) > 0:
                    db.execute("INSERT INTO exams VALUES(?,?,?,?,?,?,?,?,?,?)", (day, exam, str(meta.get("tieu_de") or exam), str(meta.get("che_do") or ""), ma,
                               num(r.get("diem")), num(r.get("tong")), num(r.get("dau", r.get("diem"))), num(r.get("cao_nhat", r.get("diem"))), int(num(r.get("lan"), 1))))
                    n_e += 1
        # Câu hỏi + lựa chọn của từng học sinh (để phân tích hiểu lầm): chỉ trắc nghiệm, ghi đè theo bài thi
        for exam, items in de.items():
            rows = items.values() if isinstance(items, dict) else (items or [])
            db.execute("DELETE FROM qbank WHERE exam=?", (exam,))
            for q in rows:
                if isinstance(q, dict) and q.get("kind") != "tl" and q.get("id") and isinstance(q.get("options"), dict) and q.get("answer"):
                    db.execute("INSERT OR REPLACE INTO qbank VALUES(?,?,?,?,?,?)", (exam, str(q["id"]), str(q.get("text") or "")[:300], str(q.get("topic") or ""),
                               str(q["answer"]).upper(), json.dumps(q["options"], ensure_ascii=False)))
        # Đề đã bị xóa / không còn là thi thử, thi thật → bỏ câu trả lời cũ (để hiểu lầm không nằm mãi)
        if "thi_nop" in data:
            keep = [e for e, by in nop.items() if isinstance(by, dict)]
            db.execute(f"DELETE FROM answers WHERE exam NOT IN ({','.join('?' * len(keep))})" if keep else "DELETE FROM answers", keep)
        if "thi_de" in data:
            keep = list(de)
            db.execute(f"DELETE FROM qbank WHERE exam NOT IN ({','.join('?' * len(keep))})" if keep else "DELETE FROM qbank", keep)
        for exam, by in nop.items():
            if not isinstance(by, dict):
                continue
            db.execute("DELETE FROM answers WHERE exam=?", (exam,))
            for ma, r in by.items():
                tl = (r or {}).get("tra_loi") if isinstance(r, dict) else None
                for qid, ch in (tl.items() if isinstance(tl, dict) else []):
                    if isinstance(ch, str) and ch.strip():
                        db.execute("INSERT OR REPLACE INTO answers VALUES(?,?,?,?)", (exam, ma, str(qid), ch.strip().upper()[:1]))
        for lesson, by in dr.items():
            for ma, v in (by or {}).items():
                if isinstance(v, dict):
                    db.execute("INSERT INTO reads VALUES(?,?,?,?)", (day, ma, lesson, num(v.get("pct"))))
                    n_r += 1
    return {"students": len(hs), "mastery": n_m, "exams": n_e, "reads": n_r}


def add_questions(db: sqlite3.Connection, items: Iterable[dict[str, Any]], keyof) -> int:
    n = 0
    with db:
        for it in items:
            cur = db.execute("INSERT OR IGNORE INTO questions VALUES(?,?,?,?,?,?,?)",
                             (int(num(it.get("at"))), keyof(str(it.get("uid") or "")), str(it.get("lop") or ""), str(it.get("course") or ""),
                              str(it.get("lesson") or ""), str(it.get("q") or "")[:300], 1 if it.get("blocked") else 0))
            n += cur.rowcount
    return n


def save_report(db: sqlite3.Connection, day: str, lop: str, md: str, facts: dict) -> None:
    with db:
        db.execute("INSERT INTO reports VALUES(?,?,?,?) ON CONFLICT(day, lop) DO UPDATE SET md=excluded.md, facts=excluded.facts",
                   (day, lop, md, json.dumps(facts, ensure_ascii=False)))


def save_study(db: sqlite3.Connection, by_day: dict[str, Any], keyof) -> int:
    """Số phút học mỗi ngày (Firebase thoi_gian/{ngày}/{mã}); ghi đè theo ngày vì Firebase luôn giữ tổng mới nhất."""
    n = 0
    with db:
        for day, per in (by_day or {}).items():
            if not isinstance(per, dict):
                continue
            for ma, v in per.items():
                m = int(num(v))
                if 0 < m <= 1440:
                    db.execute("INSERT INTO study(day, ma, minutes) VALUES(?,?,?) ON CONFLICT(day, ma) DO UPDATE SET minutes=MAX(minutes, excluded.minutes)", (day, keyof(ma), m))
                    n += 1
    return n
