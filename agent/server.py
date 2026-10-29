"""Dịch vụ agent (FastAPI). Chỉ nghe 127.0.0.1; Caddy lo HTTPS. Mọi yêu cầu (trừ /health) phải có X-Agent-Key."""
from __future__ import annotations
import hmac
import logging
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from . import __version__
from .config import Config
from .grading import grade_batch
from .llm import LLM, LLMError
from .rubric import get_rubric
from .store import Store, qhash
from .verify import verify_questions

log = logging.getLogger("agent")


class GradeItem(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    guide: str = Field(default="", max_length=2000)
    answer: str = Field(default="", max_length=3000)
    max: float = Field(gt=0, le=20)


class GradeReq(BaseModel):
    title: str = Field(default="", max_length=200)
    items: list[GradeItem] = Field(min_length=1, max_length=10)
    votes: int | None = Field(default=None, ge=1, le=5)


class CorrectReq(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    guide: str = Field(default="", max_length=2000)
    max: float = Field(gt=0, le=20)
    answer: str = Field(min_length=1, max_length=3000)
    score: float = Field(ge=0)
    note: str = Field(default="", max_length=300)


class QItem(BaseModel):
    text: str = Field(max_length=1000)
    options: dict[str, str]
    answer: str = Field(max_length=2)


class VerifyReq(BaseModel):
    questions: list[QItem] = Field(min_length=1, max_length=30)
    lesson: str = Field(default="", max_length=8000)


def create_app(cfg: Config, llm: LLM | None = None, store: Store | None = None) -> FastAPI:
    app = FastAPI(title="AI Học Tập – Bộ não đa agent", version=__version__, docs_url=None, redoc_url=None, openapi_url=None)
    llm = llm or LLM(keys=cfg.gemini_keys, models=[cfg.gemini_model, cfg.gemini_fallback], base_url=cfg.gemini_url,
                     openai_base_url=cfg.openai_base_url, openai_api_key=cfg.openai_api_key, openai_model=cfg.openai_model)
    store = store or Store(cfg.db_path)
    app.state.llm, app.state.store = llm, store

    def auth(x_agent_key: str = Header(default="")) -> None:
        if not cfg.agent_key or not hmac.compare_digest(x_agent_key.encode(), cfg.agent_key.encode()):
            raise HTTPException(401, "Sai khóa agent.")

    def fail(e: Exception) -> HTTPException:
        if isinstance(e, LLMError):
            return HTTPException(e.status, {"detail": str(e), "kind": e.kind})
        log.exception("agent error")
        return HTTPException(500, {"detail": "Agent gặp lỗi.", "kind": "other"})

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"ok": True, "version": __version__}   # công khai: không lộ cấu hình

    @app.get("/status", dependencies=[Depends(auth)])
    def status() -> dict[str, Any]:
        return {"version": __version__, "models": llm.models, "khoa": llm.status(), "thong_ke": store.stats()}

    @app.post("/grade", dependencies=[Depends(auth)])
    async def grade(req: GradeReq) -> dict[str, Any]:
        try:
            r = await grade_batch(llm, store, req.title, [i.model_dump() for i in req.items], req.votes or cfg.votes, cfg.concurrency)
            r["agent"] = {"version": __version__, "model": llm.last_model}
            return r
        except Exception as e:
            raise fail(e) from e

    @app.post("/correct", dependencies=[Depends(auth)])
    async def correct(req: CorrectReq) -> dict[str, Any]:
        """Giáo viên sửa điểm một bài → lưu làm ví dụ mẫu cho đúng câu đó (AI học từ giáo viên)."""
        if req.score > req.max:
            raise HTTPException(400, "Điểm vượt tối đa.")
        await get_rubric(store, None, req.text, req.guide, req.max)
        rid = store.add_correction(qhash(req.text, req.guide, req.max), req.answer, req.score, req.max, req.note)
        return {"ok": True, "id": rid}

    @app.post("/verify-questions", dependencies=[Depends(auth)])
    async def verify(req: VerifyReq) -> dict[str, Any]:
        try:
            return await verify_questions(llm, store, [q.model_dump() for q in req.questions], req.lesson)
        except Exception as e:
            raise fail(e) from e

    return app
