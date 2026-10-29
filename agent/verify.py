"""Agent Kiểm đề: câu trắc nghiệm do AI soạn được một agent KHÁC tự giải (không thấy đáp án).
Giải ra khác đáp án đã ghi, hoặc câu sai khuôn (thiếu / trùng phương án, đáp án không có trong lựa chọn) → loại, kèm lý do."""
from __future__ import annotations
import time
from typing import Any

from pydantic import BaseModel, Field

from .llm import LLM
from .store import Store
from .textutil import norm

L = ["A", "B", "C", "D"]


class Giai(BaseModel):
    so: int = Field(ge=1, le=50)
    chon: str
    chac_chan: bool = True


class GiaiOut(BaseModel):
    giai: list[Giai] = Field(default_factory=list, max_length=50)


SOLVE = """Em là học sinh giỏi Tin học THCS. Giải từng câu trắc nghiệm dưới đây, mỗi câu chọn MỘT phương án đúng nhất (A, B, C hoặc D).
Nếu câu có nhiều phương án đúng như nhau hoặc không có phương án nào đúng, đặt "chac_chan": false.
{lesson}
{qs}

Chỉ trả JSON: {{"giai": [{{"so": 1, "chon": "B", "chac_chan": true}}]}}"""


def shape_problem(q: dict[str, Any]) -> str:
    opts = q.get("options") or {}
    if not str(q.get("text", "")).strip():
        return "thiếu nội dung câu hỏi"
    vals = [str(opts.get(k, "")).strip() for k in L]
    if any(not v for v in vals):
        return "thiếu phương án"
    if len({norm(v) for v in vals}) < 4:
        return "có phương án trùng nhau"
    if str(q.get("answer", "")).strip().upper() not in L:
        return "đáp án không nằm trong A–D"
    return ""


async def verify_questions(llm: LLM, store: Store, questions: list[dict[str, Any]], lesson: str = "") -> dict[str, Any]:
    t0 = time.monotonic()
    result: list[dict[str, Any]] = []
    todo: list[tuple[int, dict[str, Any]]] = []
    for i, q in enumerate(questions):
        p = shape_problem(q)
        result.append({"giu": not p, "ly_do": p, "ai_chon": ""})
        if not p:
            todo.append((i, q))
    if todo:
        text = "\n\n".join(f"Câu {k + 1}: {q['text']}\n" + "\n".join(f"{x}. {q['options'][x]}" for x in L) for k, (_, q) in enumerate(todo))
        lesson_txt = f"\nNỘI DUNG BÀI HỌC THAM KHẢO:\n\"\"\"\n{lesson[:4000]}\n\"\"\"\n" if lesson else ""
        out = await llm.structured(SOLVE.format(lesson=lesson_txt, qs=text), GiaiOut, temperature=0.1, max_tokens=1200)
        by = {g.so: g for g in out.giai}
        for k, (i, q) in enumerate(todo):
            g = by.get(k + 1)
            if not g:
                result[i].update(giu=False, ly_do="agent kiểm không giải được câu này")
                continue
            chon = g.chon.strip().upper()[:1]
            result[i]["ai_chon"] = chon
            if not g.chac_chan:
                result[i].update(giu=False, ly_do="câu mơ hồ: nhiều hoặc không có phương án đúng")
            elif chon != str(q["answer"]).strip().upper():
                result[i].update(giu=False, ly_do=f"agent tự giải ra {chon}, khác đáp án đã ghi {str(q['answer']).upper()}")
    store.log_run("verify", int((time.monotonic() - t0) * 1000), llm.last_model, 1, sum(r["giu"] for r in result), len(result))
    return {"ket_qua": result, "giu": sum(r["giu"] for r in result), "loai": sum(not r["giu"] for r in result)}
