"""Tách gợi ý đáp án của giáo viên thành các ý chấm có điểm (tiêu chí). Ưu tiên đọc bằng luật (không tốn AI):
  "- Điện thoại (1đ)", "Ý 2: ... (0,5 điểm)", "+ Kiểm tra nguồn tin: 0.5đ".
Không đọc được điểm thì chia đều theo dòng gạch đầu dòng; gợi ý là một đoạn văn thì nhờ AI tách. Kết quả lưu lại theo câu."""
from __future__ import annotations
import re
from typing import Any

from pydantic import BaseModel, Field

from .llm import LLM
from .store import Store, qhash
from .textutil import round_q

PT = r"(\d+(?:[.,]\d+)?)\s*(?:đ|điểm|diem|d)\b\.?"
RE_END = re.compile(r"[\(\[]?\s*" + PT + r"\s*[\)\]]?\s*[.;,]?\s*$", re.I)
RE_START = re.compile(r"^\s*[\(\[]?\s*" + PT + r"\s*[\)\]]?\s*[:\-–]\s*", re.I)
BULLET = re.compile(r"^\s*(?:[-+•*●○▪]|\d+[.)]|[a-zA-Z][.)]|ý\s*\d+\s*[:.)])\s*", re.I)


class RubricItem(BaseModel):
    noi_dung: str = Field(min_length=1)
    diem: float = Field(ge=0)


class RubricOut(BaseModel):
    y: list[RubricItem] = Field(min_length=1, max_length=10)


def _num(s: str) -> float:
    return float(s.replace(",", "."))


def fit_total(items: list[dict[str, Any]], max_points: float) -> list[dict[str, Any]]:
    """Đưa tổng điểm các ý về đúng điểm tối đa (làm tròn 0,25; phần dư dồn vào ý lớn nhất)."""
    total = sum(i["diem"] for i in items) or 1.0
    out = [{"noi_dung": i["noi_dung"], "diem": round_q(i["diem"] * max_points / total)} for i in items]
    diff = round_q(max_points - sum(i["diem"] for i in out))
    if diff and out:
        k = max(range(len(out)), key=lambda j: out[j]["diem"])
        out[k]["diem"] = round_q(max(0.0, out[k]["diem"] + diff))
    return [i for i in out if i["diem"] > 0] or [{"noi_dung": items[0]["noi_dung"], "diem": max_points}]


def parse_guide(guide: str, max_points: float) -> list[dict[str, Any]] | None:
    lines = [l.strip() for l in re.split(r"\r?\n", guide or "") if l.strip()]
    if not lines:
        return None
    with_pts: list[dict[str, Any]] = []
    plain: list[str] = []
    for line in lines:
        m = RE_END.search(line)
        if m:
            text = BULLET.sub("", line[:m.start()]).strip(" :-–")
            with_pts.append({"noi_dung": text or line, "diem": _num(m.group(1))})
            continue
        m = RE_START.match(line)
        if m:
            with_pts.append({"noi_dung": BULLET.sub("", line[m.end():]).strip() or line, "diem": _num(m.group(1))})
            continue
        plain.append(line)
    if with_pts:
        s = sum(i["diem"] for i in with_pts)
        if abs(s - max_points) <= 0.01:
            return with_pts
        if s > 0 and 0.5 <= max_points / s <= 2:   # giáo viên ghi thang khác (vd tổng 2đ cho câu 1,5đ) → quy đổi
            return fit_total(with_pts, max_points)
        return None
    bullets = [BULLET.sub("", l).strip() for l in plain if BULLET.match(l)]
    if 2 <= len(bullets) <= 8 and max_points / len(bullets) >= 0.25:
        return fit_total([{"noi_dung": b, "diem": 1.0} for b in bullets], max_points)
    return None


RUBRIC_PROMPT = """Em là giáo viên Tin học THCS. Hãy tách GỢI Ý ĐÁP ÁN dưới đây thành các ý chấm điểm độc lập (2–6 ý), tổng điểm đúng bằng {max} điểm.
Mỗi ý là một điều học sinh cần nêu được, viết ngắn gọn bằng tiếng Việt.

CÂU HỎI: {q}
GỢI Ý ĐÁP ÁN: {g}

Chỉ trả JSON: {{"y": [{{"noi_dung": "...", "diem": 0.5}}]}}"""


async def get_rubric(store: Store, llm: LLM | None, question: str, guide: str, max_points: float) -> tuple[list[dict[str, Any]], str]:
    h = qhash(question, guide, max_points)
    cached = store.get_rubric(h)
    if cached:
        return cached, h
    items = parse_guide(guide, max_points)
    source = "luat"
    if not items and llm is not None:
        try:
            out = await llm.structured(RUBRIC_PROMPT.format(max=max_points, q=question[:1000], g=guide[:2000]), RubricOut, temperature=0.1, max_tokens=800)
            items = fit_total([i.model_dump() for i in out.y], max_points)
            source = "ai"
        except Exception:
            items = None
    if not items:   # vẫn không tách được: một ý duy nhất là toàn bộ gợi ý
        items, source = [{"noi_dung": (guide or question)[:400], "diem": max_points}], "nguyen_van"
    store.put_rubric(h, items, source)
    return items, h
