"""Báo cáo cho giáo viên: Gemini diễn đạt số liệu (analyze.py) thành lời + gợi ý hành động; không có AI thì dùng mẫu."""
from __future__ import annotations
import json
from typing import Any

PROMPT = """Em là trợ lý chuyên môn của giáo viên Tin học THCS. Viết BÁO CÁO TUẦN cho giáo viên về lớp {lop} dựa ĐÚNG số liệu JSON dưới đây (máy đã tính, không bịa thêm số).
Mục tiêu: giáo viên biết học sinh đang học thế nào, hay hỏi gì, ai cần chú ý, và tuần tới nên làm gì.
Viết tiếng Việt, ngắn gọn, markdown, tối đa 450 từ, đúng 7 mục có tiêu đề in đậm:
**Tóm tắt** (2–3 câu) · **Xu hướng chủ đề** (chủ đề yếu nhất, chủ đề tiến bộ/sa sút nếu có số tuần trước) · **Học sinh hay hỏi gì** (suy ra hiểu lầm từ cụm từ và ví dụ câu hỏi; nêu nếu có em cố xin đáp án) · **Hiểu lầm phổ biến** (từ trường hieu_lam: câu nào nhiều em sai, em hay chọn nhầm điều gì, gợi ý cách chữa 1 câu; nếu trường rỗng ghi "chưa đủ dữ liệu thi") · **Chất lượng câu hỏi** (từ trường chat_luong_cau_hoi: câu nào cần xem lại và vì sao, giữ nguyên nhận định của máy, ví dụ nghi sai đáp án / quá khó / phân biệt thấp; nếu rỗng ghi "chưa thấy câu cần xem lại") · **Học sinh cần chú ý** (tên + lý do, tối đa 6 em) · **Đề xuất tuần tới** (3–4 việc cụ thể: dạy lại 5–10 phút chủ đề nào, ra thi thử/trò chơi câu hỏi chủ đề nào, gặp riêng em nào).
Báo cáo này chỉ giáo viên đọc: chỉ nêu đáp án của câu trong mục Hiểu lầm phổ biến để giáo viên dạy lại, không nêu đáp án nơi khác. Trả về DUY NHẤT JSON: {{"md": "nội dung markdown"}}.

SỐ LIỆU:
{facts}"""


def anonymize(facts: dict[str, Any]) -> tuple[dict[str, Any], dict[str, str]]:
    """Thay tên học sinh bằng HS1, HS2… trước khi gửi Gemini (trẻ em: không gửi tên cho bên thứ ba)."""
    f = json.loads(json.dumps(facts, ensure_ascii=False))
    names: dict[str, str] = {}
    def code(ten: str) -> str:
        if ten not in names:
            names[ten] = f"HS{len(names) + 1}"
        return names[ten]
    for r in f.get("can_chu_y") or []:
        r["ten"] = code(str(r.get("ten") or "")); r.pop("ma", None)
    for r in (f.get("cau_hoi") or {}).get("em_hoi_nhieu") or []:
        r["ten"] = code(str(r.get("ten") or ""))
    return f, {v: k for k, v in names.items()}


def deanonymize(md: str, back: dict[str, str]) -> str:
    for c in sorted(back, key=len, reverse=True):   # HS12 trước HS1
        md = md.replace(c, back[c])
    return md


def build_prompt(facts: dict[str, Any]) -> str:
    """facts phải đã qua anonymize()."""
    return PROMPT.format(lop=facts.get("lop", ""), facts=json.dumps(facts, ensure_ascii=False)[:14000])


def fallback_md(f: dict[str, Any]) -> str:
    """Báo cáo dạng mẫu (khi chưa cài Gemini hoặc AI lỗi) — vẫn đủ số liệu."""
    if not f.get("students"):
        return f"**Lớp {f.get('lop')}**: chưa có học sinh."
    lines = [f"**Tóm tắt** Lớp {f['lop']}: {f['students']} học sinh"
             + (f", {f['hoat_dong_7_ngay']} em học trên app 7 ngày qua" if f.get("hoat_dong_7_ngay") is not None else "")
             + (f", năng lực trung bình {f['nang_luc_tb']}%" if f.get("nang_luc_tb") is not None else "") + "."]
    ct = f.get("chu_de") or []
    if ct:
        lines.append("**Xu hướng chủ đề** " + "; ".join(f"{t['ten']} {t['pct']}%" + (f" ({'+' if t['delta'] >= 0 else ''}{t['delta']})" if t.get("delta") is not None else "") for t in ct[:5]) + ".")
    q = f.get("cau_hoi") or {}
    if q.get("tong_7_ngay"):
        lines.append(f"**Học sinh hay hỏi gì** {q['tong_7_ngay']} câu hỏi Gia sư từ {q['so_em_hoi']} em"
                     + (": " + ", ".join(f"“{k['w']}” ({k['n']})" for k in q.get("cum_tu", [])[:6]) if q.get("cum_tu") else "")
                     + (f". {q['xin_dap_an']} lần cố xin đáp án." if q.get("xin_dap_an") else "."))
    hl = f.get("hieu_lam") or []
    if hl:
        lines.append("**Hiểu lầm phổ biến** " + "; ".join(f"“{h['cau'][:80]}” {h['ti_le_sai']}% sai, hay chọn nhầm “{h['hay_chon_sai'][:60]}” (đúng: “{h['dap_an_dung'][:60]}”)" for h in hl[:3]) + ".")
    cl = f.get("chat_luong_cau_hoi") or []
    if cl:
        lines.append("**Chất lượng câu hỏi** " + "; ".join(f"“{c['cau'][:70]}” ({c['de']}): {', '.join(c['van_de'])}" for c in cl[:3]) + ".")
    risk = f.get("can_chu_y") or []
    if risk:
        lines.append("**Học sinh cần chú ý** " + "; ".join(f"{r['ten']} ({', '.join(r['ly_do'])})" for r in risk[:6]) + ".")
    weak = [t["ten"] for t in ct if t["pct"] < 50][:2]
    tips = []
    if weak:
        tips.append(f"dạy lại 10 phút: {', '.join(weak)}")
        tips.append(f"mở trò chơi câu hỏi về {weak[0]}")
    if risk:
        tips.append("gặp riêng: " + ", ".join(r["ten"] for r in risk[:3]))
    if tips:
        lines.append("**Đề xuất tuần tới** " + "; ".join(tips) + ".")
    return "\n\n".join(lines)
