"""Gọi ra ngoài (chỉ HTTPS đi ra, VPS không mở cổng): Firebase REST, Worker, Google Sheet, Gemini."""
from __future__ import annotations
import json
import time
import urllib.parse
import urllib.request
from typing import Any

UA = {"User-Agent": "goc-hoc-tap-brain/1.0"}


def http(method: str, url: str, body: Any = None, headers: dict[str, str] | None = None, timeout: int = 60, tries: int = 3) -> Any:
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    last: Exception | None = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, method=method, headers={**UA, "Content-Type": "application/json", **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                txt = r.read().decode("utf-8")
                return json.loads(txt) if txt else None
        except urllib.error.HTTPError as e:   # lỗi quyền / dữ liệu: không thử lại
            if e.code in (400, 401, 403, 404):
                raise RuntimeError(f"{method} {url.split('?')[0]} → HTTP {e.code}") from None
            last = e
        except Exception as e:  # mạng chập chờn
            last = e
        time.sleep(2 * (i + 1))
    raise RuntimeError(f"{method} {url.split('?')[0]} lỗi: {last}")


def fb_get(fb_url: str, secret: str, path: str) -> Any:
    return http("GET", f"{fb_url}/{path}.json?auth={urllib.parse.quote(secret)}")


def fb_shallow(fb_url: str, secret: str, path: str) -> list[str]:
    d = http("GET", f"{fb_url}/{path}.json?shallow=true&auth={urllib.parse.quote(secret)}")
    return list((d or {}).keys())


def worker_questions(worker_url: str, brain_key: str, since: int) -> list[dict[str, Any]]:
    d = http("GET", f"{worker_url}/api/brain/export?since={int(since)}", headers={"X-Brain-Key": brain_key})
    return list((d or {}).get("items") or [])


def worker_push_hieu_lam(worker_url: str, brain_key: str, items: dict[str, list[dict[str, str]]]) -> dict[str, Any]:
    """Gửi hiểu lầm riêng từng em lên Worker (thay toàn bộ bản cũ) để Gia sư hỏi gợi mở đúng chỗ."""
    return http("POST", f"{worker_url}/api/brain/hieu-lam", body={"items": items}, headers={"X-Brain-Key": brain_key}) or {}


def sheet_save(sheet_url: str, key: str, reports: list[dict[str, Any]]) -> Any:
    # Apps Script nhận text/plain; urllib tự theo chuyển hướng 302 của Google để lấy kết quả.
    req = urllib.request.Request(sheet_url, data=json.dumps({"action": "brain_save", "key": key, "reports": reports}, ensure_ascii=False).encode("utf-8"),
                                 method="POST", headers={**UA, "Content-Type": "text/plain;charset=utf-8"})
    with urllib.request.urlopen(req, timeout=90) as r:
        d = json.loads(r.read().decode("utf-8") or "{}")
    if not d.get("ok"):
        raise RuntimeError("Google Sheet từ chối: " + str(d.get("error")))
    return d


def gemini(gemini_url: str, model: str, api_key: str, prompt: str) -> str:
    d = http("POST", f"{gemini_url}/{model}:generateContent", headers={"x-goog-api-key": api_key}, timeout=90, body={
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096, "responseMimeType": "application/json"}})
    parts = (((d or {}).get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought"))
