"""Phân tích từng lớp (máy tính, không AI): xu hướng chủ đề, học sinh cần chú ý, học sinh hay hỏi gì.

Mọi con số trong báo cáo đều đến từ đây; AI (report.py) chỉ diễn đạt thành lời và gợi ý hành động.
"""
from __future__ import annotations
import json
import re
import sqlite3
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

GOOD, WEAK = 80, 50
STOP = set("""là của và có các những một cho em thầy cô gì nào không được trong với này đó thì mà để khi bài học hãy giúp ạ nhé như thế sao vậy
ơi à ừ ạ nha luôn cũng rồi đã đang sẽ bị vì nên nếu thì hay hoặc hơn rất lắm quá còn chưa mình bạn tôi tớ các cái con người làm ra vào lên xuống
về từ trên dưới theo nữa đi đến biết hiểu giải thích hỏi cho_em ai đâu bao nhiêu mấy thế_nào tại""".split())
STOP |= {"là gì", "thế nào", "như thế", "tại sao"}


def keyof(ma: str) -> str:
    """Khóa học sinh giống ứng dụng (thi-store.keyOf)."""
    return re.sub(r"[.#$\[\]/]", "_", str(ma or "").strip().lower())


def pct(d: float, n: float) -> int:
    return round(100 * d / n) if n else 0


def days_ago(day: str, k: int) -> str:
    return (date.fromisoformat(day) - timedelta(days=k)).isoformat()


def nearest_day(db: sqlite3.Connection, table: str, on_or_before: str) -> str | None:
    r = db.execute(f"SELECT MAX(day) AS d FROM {table} WHERE day<=?", (on_or_before,)).fetchone()
    return r["d"] if r and r["d"] else None


def tokens(text: str) -> list[str]:
    t = re.sub(r"[^\w\s]", " ", str(text or "").lower())
    return [w for w in t.split() if not w.isdigit()]


def keywords(questions: list[str], top: int = 10) -> list[dict[str, Any]]:
    """Cụm từ học sinh hay hỏi: tiếng Việt ghép từ 2–3 âm tiết (dữ liệu, mã nhị phân…), bỏ từ đệm; mỗi câu đếm 1 lần."""
    c: Counter[str] = Counter()
    for q in questions:
        ws, seen = tokens(q), set()
        for n in (3, 2):
            for i in range(len(ws) - n + 1):
                g = ws[i:i + n]
                if g[0] in STOP or g[-1] in STOP or " ".join(g) in STOP:
                    continue
                seen.add(" ".join(g))
        c.update(seen)
    out: list[dict[str, Any]] = []
    for w, n in sorted(c.items(), key=lambda x: (-x[1], -len(x[0].split()), x[0]))[:80]:
        if n < 2:
            break
        if any(w in o["w"] for o in out):   # bỏ cụm con của cụm dài hơn đã có
            continue
        out.append({"w": w, "n": n})
        if len(out) >= top:
            break
    return out


def misconceptions(db: sqlite3.Connection, ma_list: list[str], min_n: int = 4, min_wrong: int = 30, top: int = 5) -> list[dict[str, Any]]:
    """Hiểu lầm phổ biến: câu trắc nghiệm có nhiều em sai (>= min_wrong %) và đáp án sai nào được chọn nhiều nhất.

    Mỗi lựa chọn sai thường ứng với một cách hiểu sai → giáo viên biết dạy lại đúng chỗ. Chỉ dùng số đếm, không có tên học sinh.
    """
    if not ma_list:
        return []
    ph = ",".join("?" * len(ma_list))
    rows = db.execute(f"SELECT a.exam, a.qid, a.chosen, q.text, q.topic, q.answer, q.options FROM answers a "
                      f"JOIN qbank q ON q.exam=a.exam AND q.qid=a.qid WHERE a.ma IN ({ph})", ma_list).fetchall()
    groups: dict[tuple[str, str], dict[str, Any]] = {}
    for r in rows:
        g = groups.setdefault((r["exam"], r["qid"]), {"r": r, "n": 0, "sai": Counter()})
        g["n"] += 1
        if r["chosen"] != r["answer"]:
            g["sai"][r["chosen"]] += 1
    out = []
    for g in groups.values():
        wrong = sum(g["sai"].values())
        if g["n"] < min_n or pct(wrong, g["n"]) < min_wrong:
            continue
        r = g["r"]
        try:
            opts = json.loads(r["options"])
        except (TypeError, ValueError):
            opts = {}
        k, c = g["sai"].most_common(1)[0]
        out.append({"cau": r["text"][:160], "chu_de": r["topic"], "so_em": g["n"], "ti_le_sai": pct(wrong, g["n"]),
                    "dap_an_dung": str(opts.get(r["answer"], r["answer"]))[:120], "hay_chon_sai": str(opts.get(k, k))[:120], "so_em_chon_sai_nay": c})
    out.sort(key=lambda x: (-x["ti_le_sai"], -x["so_em"], x["cau"]))
    return out[:top]


def class_facts(db: sqlite3.Connection, lop: str, today: str, tz_hours: int = 7) -> dict[str, Any]:
    """Số liệu một lớp hôm nay so với 7 ngày trước."""
    studs = {r["ma"]: r["ten"] for r in db.execute("SELECT ma, ten FROM students WHERE lower(lop)=lower(?)", (lop,))}
    if not studs:
        return {"lop": lop, "students": 0}
    ph = ",".join("?" * len(studs))
    ma_list = list(studs)
    d_now = nearest_day(db, "mastery", today)
    d_old = nearest_day(db, "mastery", days_ago(today, 7))
    if d_old == d_now:
        d_old = None

    def mastery_on(day: str | None) -> tuple[dict, dict]:
        topics: dict[str, dict] = defaultdict(lambda: {"ten": "", "d": 0.0, "n": 0.0, "weak": 0})
        per: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])
        if not day:
            return {}, {}
        for r in db.execute(f"SELECT ma, topic, ten, d, n FROM mastery WHERE day=? AND ma IN ({ph})", (day, *ma_list)):
            t = topics[r["topic"]]; t["ten"] = r["ten"]; t["d"] += r["d"]; t["n"] += r["n"]
            if pct(r["d"], r["n"]) < WEAK:
                t["weak"] += 1
            per[r["ma"]][0] += r["d"]; per[r["ma"]][1] += r["n"]
        return dict(topics), {m: pct(d, n) for m, (d, n) in per.items() if n >= 3}

    t_now, p_now = mastery_on(d_now)
    t_old, p_old = mastery_on(d_old)
    topics = []
    for k, t in t_now.items():
        now = pct(t["d"], t["n"]); old = pct(t_old[k]["d"], t_old[k]["n"]) if k in t_old else None
        topics.append({"ten": t["ten"], "pct": now, "truoc": old, "delta": None if old is None else now - old, "so_cau": int(t["n"]), "em_yeu": t["weak"]})
    topics.sort(key=lambda x: (x["pct"], -x["so_cau"]))

    # Câu hỏi Gia sư 7 ngày qua
    since = int((datetime.fromisoformat(today).replace(tzinfo=timezone(timedelta(hours=tz_hours))) - timedelta(days=7)).timestamp() * 1000)
    qrows = db.execute(f"SELECT ma, q, blocked, lesson FROM questions WHERE at>=? AND ma IN ({ph})", (since, *ma_list)).fetchall()
    per_q = Counter(r["ma"] for r in qrows); blocked = Counter(r["ma"] for r in qrows if r["blocked"])
    by_lesson = Counter(r["lesson"] for r in qrows if r["lesson"])

    # Thi thử: lần đầu → cao nhất (ảnh chụp mới nhất)
    d_ex = nearest_day(db, "exams", today)
    best: dict[str, list[float]] = defaultdict(list)
    exams = []
    if d_ex:
        rows = db.execute(f"SELECT exam, title, mode, ma, dau, best, tong FROM exams WHERE day=? AND ma IN ({ph})", (d_ex, *ma_list)).fetchall()
        by_exam: dict[str, list] = defaultdict(list)
        for r in rows:
            if r["mode"] == "thu":
                by_exam[(r["exam"], r["title"])].append(r)
                best[r["ma"]].append(pct(r["best"], r["tong"]))
        for (eid, title), rs in by_exam.items():
            exams.append({"ten": title, "so_em": len(rs), "lan_dau": round(sum(pct(r["dau"], r["tong"]) for r in rs) / len(rs)), "cao_nhat": round(sum(pct(r["best"], r["tong"]) for r in rs) / len(rs))})

    # Đọc bài + hoạt động
    d_rd = nearest_day(db, "reads", today); d_rd_old = nearest_day(db, "reads", days_ago(today, 7))
    def reads_on(day: str | None) -> dict[str, float]:
        if not day:
            return {}
        return {r["ma"]: r["s"] for r in db.execute(f"SELECT ma, SUM(pct) AS s FROM reads WHERE day=? AND ma IN ({ph}) GROUP BY ma", (day, *ma_list))}
    r_now, r_old = reads_on(d_rd), reads_on(d_rd_old if d_rd_old != d_rd else None)
    ex_old_day = nearest_day(db, "exams", days_ago(today, 7))
    ex_old = {r["ma"]: r["s"] for r in db.execute(f"SELECT ma, SUM(lan) AS s FROM exams WHERE day=? AND ma IN ({ph}) GROUP BY ma", (ex_old_day, *ma_list))} if ex_old_day and ex_old_day != d_ex else {}
    ex_now = {r["ma"]: r["s"] for r in db.execute(f"SELECT ma, SUM(lan) AS s FROM exams WHERE day=? AND ma IN ({ph}) GROUP BY ma", (d_ex, *ma_list))} if d_ex else {}
    have_history = bool(d_old or d_rd_old or ex_old_day)

    def active(m: str) -> bool:
        return per_q[m] > 0 or r_now.get(m, 0) > r_old.get(m, 0) or ex_now.get(m, 0) > ex_old.get(m, 0) or (m in p_now and p_now.get(m) != p_old.get(m))

    at_risk = []
    for m, ten in studs.items():
        why = []
        if m in p_now and p_now[m] < WEAK:
            why.append(f"năng lực chung {p_now[m]}%")
        if m in p_now and m in p_old and p_now[m] - p_old[m] <= -10:
            why.append(f"giảm {p_old[m] - p_now[m]} điểm % so với tuần trước")
        if best.get(m) and max(best[m]) < WEAK:
            why.append(f"thi thử cao nhất {max(best[m])}%")
        if blocked[m] >= 3:
            why.append(f"{blocked[m]} lần cố xin đáp án Gia sư AI")
        if have_history and not active(m):
            why.append("không học trên app 7 ngày qua")
        if why:
            at_risk.append({"ma": m, "ten": ten, "ly_do": why, "nang_luc": p_now.get(m)})
    at_risk.sort(key=lambda x: (-len(x["ly_do"]), x["nang_luc"] if x["nang_luc"] is not None else 101))

    return {
        "lop": lop, "ngay": today, "students": len(studs),
        "hoat_dong_7_ngay": sum(1 for m in studs if active(m)) if have_history else None,
        "nang_luc_tb": round(sum(p_now.values()) / len(p_now)) if p_now else None,
        "chu_de": topics[:15],
        "can_chu_y": at_risk[:12],
        "cau_hoi": {"tong_7_ngay": len(qrows), "so_em_hoi": len(per_q), "xin_dap_an": sum(blocked.values()),
                    "cum_tu": keywords([r["q"] for r in qrows if not r["blocked"]]), "bai_hoi_nhieu": [{"bai": b, "n": n} for b, n in by_lesson.most_common(5)],
                    "vi_du": [r["q"] for r in qrows if not r["blocked"]][-8:],
                    "em_hoi_nhieu": [{"ten": studs[m], "n": n} for m, n in per_q.most_common(5)]},
        "thi_thu": exams,
        "hieu_lam": misconceptions(db, ma_list),
        "doc_bai_tb": (lambda r: round(r) if r is not None else None)(db.execute(f"SELECT AVG(pct) AS a FROM reads WHERE day=? AND ma IN ({ph})", (d_rd, *ma_list)).fetchone()["a"]) if d_rd else None,
    }
