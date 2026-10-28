"""Chạy: python -m brain run [--dry-run] [--no-ai] [--env .env]

run      : thu thập → lưu lịch sử → phân tích từng lớp → báo cáo (Gemini) → gửi Google Sheet
collect  : chỉ thu thập + lưu lịch sử
report   : in báo cáo một lớp ra màn hình (không gửi): python -m brain report 9A
"""
from __future__ import annotations
import argparse
import json
import sys
from datetime import datetime, timedelta, timezone

from . import analyze, report, sources, store
from .config import Config


def today(cfg: Config) -> str:
    return datetime.now(timezone(timedelta(hours=cfg.tz_offset_hours))).date().isoformat()


def collect(cfg: Config, db) -> dict:
    data: dict = {}
    for k in ("thi_hs", "nang_luc", "doc_read", "thi_bai"):
        data[k] = sources.fb_get(cfg.fb_url, cfg.fb_secret, k) or {}
    data["thi_nop"] = {}
    for eid, b in (data["thi_bai"] or {}).items():   # tải từng bài (không tải cả cây)
        if isinstance(b, dict) and b.get("che_do") in ("thu", "that"):
            data["thi_nop"][eid] = sources.fb_get(cfg.fb_url, cfg.fb_secret, f"thi_nop/{eid}") or {}
    day = today(cfg)
    stats = store.snapshot(db, day, data)
    if cfg.worker_url and cfg.brain_key:
        since = int(store.get_meta(db, "last_q_at", "0") or 0)
        items = sources.worker_questions(cfg.worker_url, cfg.brain_key, since)
        stats["questions"] = store.add_questions(db, items, analyze.keyof)
        if items:
            with db:
                store.set_meta(db, "last_q_at", str(max(int(store.num(i.get("at"))) for i in items)))
    return stats


def build_reports(cfg: Config, db, use_ai: bool = True) -> list[dict]:
    day = today(cfg)
    out = []
    lops = sorted({r["lop"] for r in db.execute("SELECT DISTINCT lop FROM students WHERE lop<>''")})
    for lop in lops:
        facts = analyze.class_facts(db, lop, day, cfg.tz_offset_hours)
        md = ""
        if use_ai and cfg.gemini_api_key and facts.get("students"):
            try:
                anon, back = report.anonymize(facts)
                txt = sources.gemini(cfg.gemini_url, cfg.gemini_model, cfg.gemini_api_key, report.build_prompt(anon))
                md = report.deanonymize(str((json.loads(txt) if txt.strip().startswith("{") else {}).get("md") or "").strip(), back)
            except Exception as e:  # AI lỗi → vẫn có báo cáo mẫu
                print(f"[AI] lớp {lop}: {e}", file=sys.stderr)
        md = md or report.fallback_md(facts)
        store.save_report(db, day, lop, md, facts)
        out.append({"lop": lop, "md": md, "facts": facts})
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="brain", description="Bộ não AI — Góc học tập")
    ap.add_argument("cmd", choices=["run", "collect", "report"])
    ap.add_argument("lop", nargs="?")
    ap.add_argument("--env", default=".env")
    ap.add_argument("--dry-run", action="store_true", help="không gửi Google Sheet")
    ap.add_argument("--no-ai", action="store_true", help="không gọi Gemini (báo cáo mẫu)")
    a = ap.parse_args(argv)
    cfg = Config.from_env(a.env)
    db = store.open_db(cfg.db_path)
    if a.cmd in ("run", "collect"):
        print("Thu thập:", collect(cfg, db))
        if a.cmd == "collect":
            return 0
    if a.cmd == "report":
        f = analyze.class_facts(db, a.lop or "", today(cfg), cfg.tz_offset_hours)
        print(json.dumps(f, ensure_ascii=False, indent=2)); print(); print(report.fallback_md(f))
        return 0
    reps = build_reports(cfg, db, use_ai=not a.no_ai)
    print(f"Đã viết {len(reps)} báo cáo lớp.")
    if a.dry_run or not (cfg.sheet_url and cfg.sheet_brain_key):
        for r in reps:
            print(f"\n===== Lớp {r['lop']} =====\n{r['md']}")
        return 0
    res = sources.sheet_save(cfg.sheet_url, cfg.sheet_brain_key, reps)
    with db:
        store.set_meta(db, "last_run", datetime.now(timezone.utc).isoformat())
    print("Đã gửi Google Sheet:", res.get("saved"), "lớp")
    return 0


if __name__ == "__main__":
    sys.exit(main())
