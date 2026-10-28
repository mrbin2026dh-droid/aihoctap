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


def suspect_items(db: sqlite3.Connection) -> set[tuple[str, str]]:
    """Câu nghi ghi sai đáp án / đề mơ hồ (mức 3): không được coi lựa chọn của học sinh ở câu này là "hiểu lầm"."""
    out: set[tuple[str, str]] = set()
    for r in db.execute("SELECT DISTINCT exam FROM qbank"):
        out |= {(r["exam"], it["qid"]) for it in item_analysis(db, r["exam"]) if it["muc"] >= 3}
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
    bad = suspect_items(db)
    for r in rows:
        if (r["exam"], r["qid"]) in bad:
            continue
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


def _opts(raw: Any) -> dict[str, str]:
    try:
        o = json.loads(raw) if isinstance(raw, str) else raw
    except (TypeError, ValueError):
        return {}
    return {str(k).upper(): str(v) for k, v in (o or {}).items()} if isinstance(o, dict) else {}


def personal_misconceptions(db: sqlite3.Connection, top: int = 3) -> dict[str, list[dict[str, str]]]:
    """Hiểu lầm riêng từng em (để Gia sư hỏi gợi mở đúng chỗ): các câu em chọn sai ở lần làm gần nhất.

    Ưu tiên lỗi nhiều bạn cùng mắc (cùng câu, cùng lựa chọn sai = hiểu lầm phổ biến, đáng chữa trước), rồi theo bài/câu cho ổn định.
    KHÔNG kèm đáp án đúng (Gia sư không được biết để không lỡ lộ). Chỉ học sinh còn trong danh sách lớp.
    """
    rows = db.execute("SELECT a.ma, a.exam, a.qid, a.chosen, q.text, q.topic, q.answer, q.options FROM answers a "
                      "JOIN qbank q ON q.exam=a.exam AND q.qid=a.qid JOIN students s ON s.ma=a.ma WHERE a.chosen<>q.answer").fetchall()
    bad = suspect_items(db)   # câu nghi sai đáp án: em chọn "sai" có thể lại là đúng → không nhắc em
    rows = [r for r in rows if (r["exam"], r["qid"]) not in bad]
    freq: Counter[tuple[str, str, str]] = Counter((r["exam"], r["qid"], r["chosen"]) for r in rows)
    per: dict[str, list] = defaultdict(list)
    for r in rows:
        txt = _opts(r["options"]).get(r["chosen"])
        if not txt:   # lựa chọn không có trong đề (dữ liệu lạ) → bỏ, không đoán
            continue
        per[r["ma"]].append((-freq[(r["exam"], r["qid"], r["chosen"])], r["exam"], r["qid"], {"cau": str(r["text"])[:160], "chon": txt[:120], "chu_de": str(r["topic"] or "")[:60]}))
    out: dict[str, list[dict[str, str]]] = {}
    for ma, items in per.items():
        items.sort(key=lambda x: x[:3])
        seen, lst = set(), []
        for *_k, it in items:
            if it["cau"] in seen:   # cùng một câu xuất hiện ở hai đề → giữ một
                continue
            seen.add(it["cau"]); lst.append(it)
            if len(lst) >= top:
                break
        k = keyof(ma)
        if lst and re.fullmatch(r"[^.#$\[\]/\s]{1,64}", k):   # đúng định dạng Worker nhận
            out[k] = lst
    return out


def item_analysis(db: sqlite3.Connection, exam: str, min_n: int = 10) -> list[dict[str, Any]]:
    """Phân tích câu hỏi kiểu khảo thí cổ điển cho một đề (tính trên MỌI em đã làm đề, mọi lớp, để đủ số liệu).

    p = tỉ lệ đúng (em bỏ trống tính là sai). D = p(nhóm 27% điểm cao) − p(nhóm 27% điểm thấp).
    Ngưỡng D theo Ebel & Frisbie: ≥0,4 rất tốt; 0,3–0,39 tốt; 0,2–0,29 tạm; <0,2 kém.
    """
    qs = db.execute("SELECT qid, text, answer, options FROM qbank WHERE exam=? ORDER BY qid", (exam,)).fetchall()
    if not qs:
        return []
    ch: dict[str, dict[str, str]] = defaultdict(dict)
    known = {q["qid"] for q in qs}
    for r in db.execute("SELECT ma, qid, chosen FROM answers WHERE exam=?", (exam,)):
        if r["qid"] in known:   # câu trả lời mang mã câu không có trong đề (dữ liệu cũ/lỗi) → không tính em đó là đã làm đề
            ch[r["ma"]][r["qid"]] = r["chosen"]
    n = len(ch)
    if n < min_n:
        return []
    key = {q["qid"]: q["answer"] for q in qs}
    score = {m: sum(1 for qid, a in key.items() if c.get(qid) == a) for m, c in ch.items()}
    order = sorted(ch, key=lambda m: (-score[m], m))   # sắp xếp ổn định: cùng điểm thì theo mã
    g = max(3, round(0.27 * n))
    up, lo = order[:g], order[-g:]
    out = []
    for q in qs:
        qid, ans, opts = q["qid"], q["answer"], _opts(q["options"])
        right = sum(1 for m in ch if ch[m].get(qid) == ans)
        p = right / n
        pu = sum(1 for m in up if ch[m].get(qid) == ans) / g
        pl = sum(1 for m in lo if ch[m].get(qid) == ans) / g
        d = pu - pl
        cnt_all = Counter(ch[m].get(qid, "") for m in ch)
        cnt_up = Counter(ch[m].get(qid, "") for m in up)
        cnt_lo = Counter(ch[m].get(qid, "") for m in lo)
        issues, sev = [], 0
        rival = max((o for o in opts if o != ans), key=lambda o: (cnt_up[o], o), default=None)
        # Dấu hiệu ghi sai đáp án: một phương án "hành xử như đáp án đúng" — nhóm điểm cao chọn nhiều hơn cả đáp án đang ghi
        # VÀ nhiều hơn nhóm điểm thấp. (Câu khó thì nhóm cao cũng có thể chọn sai nhiều, nhưng nhóm thấp còn chọn sai nhiều hơn.)
        if rival and cnt_up[rival] > cnt_up[ans] and cnt_up[rival] >= 2 and cnt_up[rival] > cnt_lo[rival]:
            issues.append(f"nhóm điểm cao chọn “{opts[rival][:60]}” ({cnt_up[rival]} em) nhiều hơn đáp án đang ghi “{opts.get(ans, ans)[:60]}” ({cnt_up[ans]} em): kiểm tra lại đáp án"); sev = 3
        elif d < 0:
            issues.append(f"nhóm điểm cao làm sai nhiều hơn nhóm điểm thấp (D = {d:.2f}): xem lại đề có mơ hồ không"); sev = 3
        if p >= 0.9:
            issues.append(f"quá dễ ({round(p * 100)}% đúng), ít giá trị phân loại"); sev = max(sev, 1)
        elif p <= 0.2 and sev < 3:
            issues.append(f"quá khó ({round(p * 100)}% đúng)"); sev = max(sev, 2)
        elif 0 <= d < 0.2 and sev < 3:
            issues.append(f"độ phân biệt thấp (D = {d:.2f}): chưa tách được em hiểu bài với em chưa hiểu"); sev = max(sev, 2)
        if n >= 20:
            dead = [opts[o][:40] for o in sorted(opts) if o != ans and cnt_all[o] == 0]
            if dead:
                issues.append("phương án nhiễu không em nào chọn: " + ", ".join(f"“{x}”" for x in dead)); sev = max(sev, 1)
        out.append({"qid": qid, "cau": str(q["text"])[:160], "so_em": n, "ti_le_dung": round(p * 100), "do_phan_biet": round(d, 2), "muc": sev, "van_de": issues})
    return out


def question_quality(db: sqlite3.Connection, ma_list: list[str], top: int = 5) -> list[dict[str, Any]]:
    """Các câu cần giáo viên xem lại, trong những đề lớp này đã làm (thống kê trên mọi em làm đề đó)."""
    if not ma_list:
        return []
    ph = ",".join("?" * len(ma_list))
    exams = [(r["exam"], r["title"]) for r in db.execute(
        f"SELECT DISTINCT a.exam, COALESCE((SELECT title FROM exams e WHERE e.exam=a.exam ORDER BY day DESC LIMIT 1), a.exam) AS title "
        f"FROM answers a WHERE a.ma IN ({ph}) ORDER BY a.exam", ma_list)]
    out = []
    for eid, title in exams:
        for it in item_analysis(db, eid):
            if it["muc"] >= 2:
                out.append({"de": str(title)[:80], **it})
    out.sort(key=lambda x: (-x["muc"], x["do_phan_biet"], x["cau"]))
    return out[:top]


def diagnose(db: sqlite3.Connection) -> list[str]:
    """Chẩn đoán dữ liệu hiểu lầm / chất lượng câu hỏi: chỉ số tổng hợp, KHÔNG in tên hay mã học sinh."""
    out: list[str] = []
    titles = {r["exam"]: r["title"] for r in db.execute("SELECT exam, title FROM exams GROUP BY exam")}
    for r in db.execute("SELECT DISTINCT exam FROM answers UNION SELECT DISTINCT exam FROM qbank ORDER BY 1"):
        e = r["exam"]
        nq = db.execute("SELECT COUNT(*) FROM qbank WHERE exam=?", (e,)).fetchone()[0]
        na = db.execute("SELECT COUNT(DISTINCT ma) FROM answers WHERE exam=?", (e,)).fetchone()[0]
        out.append(f"Đề {e} “{titles.get(e, '')}”: {na} em có câu trả lời, {nq} câu trắc nghiệm trong đề")
        for it in item_analysis(db, e, min_n=1):
            wrong = db.execute("SELECT COUNT(*) FROM answers a JOIN qbank q ON q.exam=a.exam AND q.qid=a.qid WHERE a.exam=? AND a.qid=? AND a.chosen<>q.answer", (e, it["qid"])).fetchone()[0]
            out.append(f"  câu {it['qid']}: đúng {it['ti_le_dung']}%, D = {it['do_phan_biet']}, mức {it['muc']}, {wrong} em chọn sai" + (f" | {'; '.join(it['van_de'])}" if it["van_de"] else ""))
    orphan_q = db.execute("SELECT COUNT(*) FROM answers a LEFT JOIN qbank q ON q.exam=a.exam AND q.qid=a.qid WHERE q.qid IS NULL").fetchone()[0]
    orphan_s = db.execute("SELECT COUNT(*) FROM answers a LEFT JOIN students s ON s.ma=a.ma WHERE s.ma IS NULL").fetchone()[0]
    bad_letter = db.execute("SELECT COUNT(*) FROM answers a JOIN qbank q ON q.exam=a.exam AND q.qid=a.qid WHERE instr(q.options, '\"' || a.chosen || '\"') = 0").fetchone()[0]
    wrong_all = db.execute("SELECT COUNT(DISTINCT a.ma) FROM answers a JOIN qbank q ON q.exam=a.exam AND q.qid=a.qid WHERE a.chosen<>q.answer").fetchone()[0]
    sus = suspect_items(db)
    out.append(f"Câu nghi sai đáp án (bị loại khỏi hiểu lầm): {len(sus)}")
    out.append(f"Câu trả lời không khớp câu hỏi trong đề: {orphan_q}; không khớp học sinh trong danh sách: {orphan_s}; lựa chọn không có trong phương án: {bad_letter}")
    out.append(f"Học sinh có ít nhất 1 câu sai: {wrong_all} em; sau khi loại câu nghi sai đáp án và lọc, gửi Gia sư: {len(personal_misconceptions(db))} em")
    return out


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
        "chat_luong_cau_hoi": question_quality(db, ma_list),
        "doc_bai_tb": (lambda r: round(r) if r is not None else None)(db.execute(f"SELECT AVG(pct) AS a FROM reads WHERE day=? AND ma IN ({ph})", (d_rd, *ma_list)).fetchone()["a"]) if d_rd else None,
    }
