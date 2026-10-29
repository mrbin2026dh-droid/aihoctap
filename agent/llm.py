"""Lớp mô hình: gọi Gemini (nhiều khóa, mô hình dự phòng) và tùy chọn một nhà cung cấp tương thích OpenAI.

- 429 (hết lượt) → khóa đó nghỉ 60 giây, đổi khóa khác.
- 401/403 hoặc 400 "API key not valid" → khóa đó nghỉ 10 phút, đổi khóa.
- 404 (sai tên mô hình) → sang mô hình kế tiếp.
- 5xx / mất mạng → thử lại một lần có giãn cách rồi sang mô hình kế tiếp.
- 400 "User location is not supported" → báo lỗi vùng (VPS đặt ở Việt Nam sẽ không gặp).
Đầu ra luôn là JSON; nơi gọi kiểm bằng Pydantic, sai khuôn thì gọi lại một lần kèm lỗi (mẫu "validation retry").
Không bao giờ ghi khóa vào nhật ký.
"""
from __future__ import annotations
import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Callable, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

log = logging.getLogger("agent.llm")
T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    def __init__(self, msg: str, status: int = 502, kind: str = "other"):
        super().__init__(msg)
        self.status, self.kind = status, kind


def err_kind(status: int, why: str = "") -> str:
    w = why or ""
    if status == 429:
        return "quota"
    if re.search(r"location is not supported|not supported in your (country|region)|FAILED_PRECONDITION", w, re.I):
        return "region"
    if status in (401, 403) or re.search(r"API[_ ]?key not valid|API_KEY_INVALID|API key expired|PERMISSION_DENIED", w, re.I):
        return "key"
    if status == 404:
        return "model"
    if status == 0 or status >= 500:
        return "busy"
    return "other"


def parse_json_loose(text: str) -> Any:
    """Lấy JSON từ câu trả lời (bỏ ```json … ```, lấy khối {…} hoặc […] ngoài cùng)."""
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t, flags=re.S)
    try:
        return json.loads(t)
    except Exception:
        pass
    for o, c in (("{", "}"), ("[", "]")):
        i, j = t.find(o), t.rfind(c)
        if i != -1 and j > i:
            try:
                return json.loads(t[i:j + 1])
            except Exception:
                continue
    raise ValueError("Không đọc được JSON từ câu trả lời AI")


@dataclass
class _Key:
    value: str
    until: float = 0.0   # nghỉ đến thời điểm này (time.monotonic)
    ok: int = 0
    fail: int = 0


@dataclass
class LLM:
    keys: list[str]
    models: list[str]
    base_url: str = "https://generativelanguage.googleapis.com/v1beta/models"
    openai_base_url: str = ""
    openai_api_key: str = ""
    openai_model: str = ""
    timeout: float = 40.0
    transport: httpx.AsyncBaseTransport | None = None
    sleep: Callable[[float], Any] = asyncio.sleep
    _pool: list[_Key] = field(default_factory=list, init=False)
    _turn: int = field(default=0, init=False)
    last_model: str = field(default="", init=False)

    def __post_init__(self) -> None:
        self._pool = [_Key(k) for k in self.keys if k]
        self.models = [m for i, m in enumerate(self.models) if m and m not in self.models[:i]]

    # ---------- trạng thái (không lộ khóa) ----------
    def status(self) -> list[dict[str, Any]]:
        now = time.monotonic()
        return [{"khoa": "…" + k.value[-4:], "nghi_giay": max(0, round(k.until - now)), "thanh_cong": k.ok, "loi": k.fail} for k in self._pool]

    def _keys_now(self) -> list[_Key]:
        now = time.monotonic()
        live = [k for k in self._pool if k.until <= now]
        if not live:
            return []
        i = self._turn % len(live)
        self._turn += 1   # lần sau bắt đầu từ khóa kế tiếp (chia đều lượt)
        return live[i:] + live[:i]

    async def _gemini(self, client: httpx.AsyncClient, model: str, key: str, prompt: str, temperature: float, max_tokens: int, json_mode: bool) -> tuple[int, str]:
        body: dict[str, Any] = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
                                "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens}}
        if json_mode:
            body["generationConfig"]["responseMimeType"] = "application/json"
        try:
            r = await client.post(f"{self.base_url}/{model}:generateContent", json=body, headers={"x-goog-api-key": key})
        except httpx.HTTPError:
            return 0, "network"
        if r.status_code != 200:
            return r.status_code, r.text[:300]
        try:
            d = r.json()
            parts = (d.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        except Exception:
            text = ""
        return (200, text) if text.strip() else (204, "empty")

    async def _openai(self, client: httpx.AsyncClient, prompt: str, temperature: float, max_tokens: int) -> tuple[int, str]:
        try:
            r = await client.post(f"{self.openai_base_url}/chat/completions", headers={"Authorization": f"Bearer {self.openai_api_key}"},
                                  json={"model": self.openai_model, "temperature": temperature, "max_tokens": max_tokens,
                                        "response_format": {"type": "json_object"}, "messages": [{"role": "user", "content": prompt}]})
        except httpx.HTTPError:
            return 0, "network"
        if r.status_code != 200:
            return r.status_code, r.text[:300]
        try:
            return 200, r.json()["choices"][0]["message"]["content"] or ""
        except Exception:
            return 204, "empty"

    async def text(self, prompt: str, *, temperature: float = 0.3, max_tokens: int = 2048, json_mode: bool = True) -> str:
        """Trả văn bản đầu tiên gọi thành công; hết cách thì ném LLMError (có kind để báo đúng nguyên nhân)."""
        last_status, last_why, region = 0, "", False
        async with httpx.AsyncClient(timeout=self.timeout, transport=self.transport) as client:
            for model in self.models:
                keys = self._keys_now()
                if not keys:
                    break
                tried_busy = False
                for k in keys:
                    st, out = await self._gemini(client, model, k.value, prompt, temperature, max_tokens, json_mode)
                    if st == 200:
                        k.ok += 1
                        self.last_model = model
                        return out
                    last_status, last_why = st, out
                    kind = err_kind(st, out)
                    log.warning("[LLM_FAIL] model=%s status=%s kind=%s why=%s", model, st, kind, out[:160])
                    k.fail += 1
                    if kind == "region":
                        region = True
                        break
                    if kind == "quota":
                        k.until = time.monotonic() + 60
                        continue
                    if kind == "key":
                        k.until = time.monotonic() + 600
                        continue
                    if kind == "model":
                        break
                    if st == 400 and json_mode:   # mô hình không nhận chế độ JSON → thử lại không bật
                        st2, out2 = await self._gemini(client, model, k.value, prompt, temperature, max_tokens, False)
                        if st2 == 200:
                            k.ok += 1
                            self.last_model = model
                            return out2
                        break
                    if kind in ("busy", "other") or st == 204:
                        if not tried_busy:
                            tried_busy = True
                            await self.sleep(0.8)
                            st2, out2 = await self._gemini(client, model, k.value, prompt, temperature, max_tokens, json_mode)
                            if st2 == 200:
                                k.ok += 1
                                self.last_model = model
                                return out2
                            last_status, last_why = st2, out2
                        break
                if region:
                    break
            if self.openai_base_url and self.openai_api_key and self.openai_model:
                st, out = await self._openai(client, prompt, temperature, max_tokens)
                if st == 200:
                    self.last_model = "openai:" + self.openai_model
                    return out
                last_status, last_why = st, out
        if region:
            raise LLMError("Google không cho dùng Gemini từ vùng đặt máy chủ.", 502, "region")
        if not self._pool and not self.openai_base_url:
            raise LLMError("Chưa cài khóa AI (GEMINI_API_KEYS).", 503, "key")
        kind = err_kind(last_status, last_why)
        msg = {"quota": "AI hết lượt dùng (mọi khóa). Thêm khóa hoặc thử lại sau.", "key": "Khóa AI bị từ chối.",
               "model": "Sai tên mô hình AI.", "busy": "Máy chủ AI đang quá tải."}.get(kind, f"AI chưa trả lời được (mã {last_status}).")
        raise LLMError(msg, 429 if kind == "quota" else 502, kind)

    async def structured(self, prompt: str, schema: type[T], *, temperature: float = 0.3, max_tokens: int = 2048) -> T:
        """Gọi AI, kiểm đầu ra bằng Pydantic; sai khuôn → gọi lại một lần kèm thông báo lỗi."""
        raw = await self.text(prompt, temperature=temperature, max_tokens=max_tokens)
        try:
            return schema.model_validate(parse_json_loose(raw))
        except (ValueError, ValidationError) as e:
            fix = prompt + f"\n\nLẦN TRƯỚC EM TRẢ SAI ĐỊNH DẠNG ({str(e)[:300]}). CHỈ TRẢ ĐÚNG MỘT ĐỐI TƯỢNG JSON THEO MẪU."
            raw2 = await self.text(fix, temperature=max(0.1, temperature - 0.2), max_tokens=max_tokens)
            try:
                return schema.model_validate(parse_json_loose(raw2))
            except (ValueError, ValidationError) as e2:
                raise LLMError("AI trả sai định dạng.", 502, "format") from e2
