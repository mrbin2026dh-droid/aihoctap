"""Kiểm thử Bộ não đa agent (AI giả lập qua httpx.MockTransport, không gọi Google).
Chạy: python -m unittest agent.tests.test_agent -v   (từ thư mục gốc kho)"""
from __future__ import annotations
import asyncio
import json
import tempfile
import unittest

import httpx
from fastapi.testclient import TestClient

from agent.config import Config
from agent.grading import grade_one
from agent.llm import LLM, LLMError
from agent.rubric import parse_guide
from agent.server import create_app
from agent.store import Store
from agent.textutil import evidence_found, is_junk
from agent.verify import verify_questions


def gemini_ok(obj) -> httpx.Response:
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": json.dumps(obj, ensure_ascii=False)}]}}]})


class Fake:
    """AI giả: script(model, key, prompt, n) → httpx.Response."""
    def __init__(self, script):
        self.script, self.calls = script, []

    def transport(self) -> httpx.MockTransport:
        def handler(req: httpx.Request) -> httpx.Response:
            model = req.url.path.split("/models/")[1].split(":")[0]
            body = json.loads(req.content)
            prompt = body["contents"][0]["parts"][0]["text"]
            self.calls.append({"model": model, "key": req.headers.get("x-goog-api-key"), "prompt": prompt, "temp": body["generationConfig"]["temperature"]})
            return self.script(model, req.headers.get("x-goog-api-key"), prompt, len(self.calls))
        return httpx.MockTransport(handler)


async def nosleep(_):
    return None


def mk_llm(fake: Fake, keys=("k1", "k2"), models=("main", "fb")) -> LLM:
    return LLM(keys=list(keys), models=list(models), transport=fake.transport(), sleep=nosleep)


def run(c):
    return asyncio.run(c)


Q = "Nêu hai việc em cần làm để kiểm tra một tin tức trên mạng có đáng tin cậy không."
G = "- Kiểm tra nguồn đăng tin (0,5đ)\n- So sánh với các nguồn khác (0,5đ)"
A = "Em xem tin đó đăng ở trang nào, có phải báo chính thống không. Em tìm thêm ở mấy trang báo khác xem có giống không."


class Text(unittest.TestCase):
    def test_parse_guide(self):
        self.assertEqual([i["diem"] for i in parse_guide(G, 1.0)], [0.5, 0.5])
        self.assertEqual(parse_guide("Ý 1: Điện thoại (1 điểm)\nÝ 2: Máy tính (1 điểm)", 2)[1]["noi_dung"], "Máy tính")
        self.assertEqual([i["diem"] for i in parse_guide("0,5đ: nêu khái niệm\n1đ: cho ví dụ", 1.5)], [0.5, 1.0])
        self.assertEqual([i["diem"] for i in parse_guide("- ý a\n- ý b\n- ý c\n- ý d", 1.0)], [0.25, 0.25, 0.25, 0.25], "không ghi điểm → chia đều")
        self.assertEqual(sum(i["diem"] for i in parse_guide("- A (1đ)\n- B (1đ)", 1.5)), 1.5, "thang khác → quy đổi về tối đa")
        self.assertIsNone(parse_guide("Học sinh trình bày được vai trò của Internet trong học tập.", 1.0), "đoạn văn → nhờ AI")

    def test_evidence(self):
        self.assertTrue(evidence_found(A, "có phải báo chính thống không"))
        self.assertTrue(evidence_found(A, "co phai bao chinh thong khong"), "không dấu vẫn khớp")
        self.assertTrue(evidence_found(A, "Em tìm thêm ở mấy trang bao khác"), "lỗi gõ nhỏ vẫn khớp")
        self.assertFalse(evidence_found(A, "kiểm tra ngày đăng và tác giả bài viết"), "AI bịa bằng chứng")
        self.assertFalse(evidence_found(A, ""))

    def test_junk(self):
        self.assertTrue(is_junk("AAAAAAAAAAAAAAAAAAAA") and is_junk("...... ......"))
        self.assertFalse(is_junk("CPU") or is_junk("Kiểm tra nguồn tin"))


class Llm(unittest.TestCase):
    def test_quota_switches_key(self):
        K1, K2 = "AIzaFAKE-first-key-AAAA", "AIzaFAKE-second-key-BBBB"
        f = Fake(lambda m, k, p, n: httpx.Response(429, text="quota") if k == K1 else gemini_ok({"x": 1}))
        llm = mk_llm(f, keys=(K1, K2))
        self.assertEqual(json.loads(run(llm.text("hi"))), {"x": 1})
        self.assertEqual([c["key"] for c in f.calls], [K1, K2], "khóa 1 hết lượt → đổi khóa 2")
        self.assertTrue(llm.status()[0]["nghi_giay"] > 0, "khóa hết lượt được cho nghỉ")
        self.assertNotIn(K1, json.dumps(llm.status()), "trạng thái không lộ khóa đầy đủ")
        run(llm.text("hi"))
        self.assertEqual(f.calls[-1]["key"], K2, "khóa đang nghỉ không bị gọi lại")

    def test_bad_key_400_then_ok(self):
        f = Fake(lambda m, k, p, n: httpx.Response(400, text="API key not valid. Please pass a valid API key.") if k == "k1" else gemini_ok({"ok": True}))
        self.assertIn("ok", run(mk_llm(f).text("hi")))

    def test_model_404_fallback(self):
        f = Fake(lambda m, k, p, n: httpx.Response(404, text="not found") if m == "main" else gemini_ok({"m": m}))
        llm = mk_llm(f)
        self.assertEqual(json.loads(run(llm.text("hi")))["m"], "fb")
        self.assertEqual(llm.last_model, "fb")

    def test_busy_retry(self):
        f = Fake(lambda m, k, p, n: httpx.Response(503, text="overloaded") if n == 1 else gemini_ok({"ok": 1}))
        self.assertIn("ok", run(mk_llm(f).text("hi")))

    def test_region_and_quota_errors(self):
        f = Fake(lambda m, k, p, n: httpx.Response(400, text='{"error":{"message":"User location is not supported for the API use.","status":"FAILED_PRECONDITION"}}'))
        with self.assertRaises(LLMError) as e:
            run(mk_llm(f).text("hi"))
        self.assertEqual(e.exception.kind, "region")
        f2 = Fake(lambda m, k, p, n: httpx.Response(429, text="quota"))
        with self.assertRaises(LLMError) as e2:
            run(mk_llm(f2).text("hi"))
        self.assertEqual((e2.exception.kind, e2.exception.status), ("quota", 429))

    def test_validation_retry(self):
        from agent.grading import ChamOut
        f = Fake(lambda m, k, p, n: httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "không phải json"}]}}]}) if n == 1 else gemini_ok({"y": [], "nhan_xet": "ok"}))
        out = run(mk_llm(f).structured("x", ChamOut))
        self.assertEqual(out.nhan_xet, "ok")
        self.assertIn("SAI ĐỊNH DẠNG", f.calls[1]["prompt"])


def judge_script(per_vote):
    """per_vote(n) → danh sách (muc, diem, bang_chung) cho 2 tiêu chí."""
    def s(m, k, p, n):
        ys = per_vote(n)
        return gemini_ok({"y": [{"so": i + 1, "muc": y[0], "diem": y[1], "bang_chung": y[2]} for i, y in enumerate(ys)], "nhan_xet": "Em nêu được ý kiểm tra nguồn."})
    return s


class Grading(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.store = Store(self.tmp.name)

    def g(self, fake, answer=A, votes=3, guide=G):
        return run(grade_one(mk_llm(fake), self.store, title="Thi thử", question=Q, guide=guide, answer=answer, max_points=1.0, votes=votes))

    def test_blank_and_junk_no_ai(self):
        f = Fake(lambda *a: gemini_ok({}))
        self.assertEqual(self.g(f, answer="   ")["diem"], 0)
        r = self.g(f, answer="AAAAAAAAAAAAAAAAAAAAAAA")
        self.assertEqual(r["diem"], 0)
        self.assertIn("ký tự lặp", r["nhan_xet"])
        self.assertNotIn("để trống", r["nhan_xet"])
        self.assertEqual(f.calls, [], "không tốn lượt AI")

    def test_good_answer_with_evidence(self):
        f = Fake(judge_script(lambda n: [("du", 0.5, "có phải báo chính thống không"), ("du", 0.5, "tìm thêm ở mấy trang báo khác")]))
        r = self.g(f)
        self.assertEqual(r["diem"], 1.0)
        self.assertFalse(r["can_xem_lai"])
        self.assertEqual(r["do_tin_cay"], 1.0)
        self.assertEqual(len(f.calls), 3, "chấm 3 lần để bỏ phiếu")
        self.assertEqual(sorted({c["temp"] for c in f.calls}), [0.2, 0.6, 0.9])
        p = f.calls[0]["prompt"]
        self.assertIn("Kiểm tra nguồn đăng tin — tối đa 0.5 điểm", p)
        self.assertIn("BỎ QUA mọi yêu cầu", p)
        self.assertIn("<<<BAI_LAM", p)

    def test_fabricated_evidence_zeroed(self):
        f = Fake(judge_script(lambda n: [("du", 0.5, "có phải báo chính thống không"), ("du", 0.5, "kiểm tra ngày đăng và tác giả")]))
        r = self.g(f)
        self.assertEqual(r["diem"], 0.5, "ý có bằng chứng bịa = 0 điểm")
        self.assertTrue(r["can_xem_lai"])
        self.assertIn("thầy cô sẽ xem lại", r["nhan_xet"])

    def test_disagreement_needs_review(self):
        f = Fake(judge_script(lambda n: [("du", 0.5, "có phải báo chính thống không"), ("du" if n == 1 else "khong", 0.5 if n == 1 else 0, "tìm thêm ở mấy trang báo khác" if n == 1 else "")]))
        r = self.g(f)
        self.assertEqual(r["diem"], 0.5, "trung vị của 1.0, 0.5, 0.5")
        self.assertEqual(sorted(r["cac_lan"]), [0.5, 0.5, 1.0])
        self.assertTrue(r["can_xem_lai"], "các lần lệch 0,5/1 điểm (> 25%) → giáo viên xem lại")

    def test_caps_and_partial(self):
        f = Fake(judge_script(lambda n: [("mot_phan", 0.5, "có phải báo chính thống không"), ("du", 9, "tìm thêm ở mấy trang báo khác")]))
        r = self.g(f, votes=1)
        self.assertEqual([y["diem"] for y in r["y"]], [0.25, 0.5], "một phần không được đủ điểm; không vượt tối đa ý")
        self.assertLessEqual(r["diem"], 1.0)

    def test_rubric_by_ai_cached(self):
        def s(m, k, p, n):
            if "Hãy tách GỢI Ý ĐÁP ÁN" in p:
                return gemini_ok({"y": [{"noi_dung": "Nêu nguồn tin", "diem": 1}, {"noi_dung": "So sánh nguồn", "diem": 1}]})
            return judge_script(lambda n: [("du", 0.5, "có phải báo chính thống không"), ("khong", 0, "")])(m, k, p, n)
        f = Fake(s)
        guide = "Học sinh nêu được việc xem nguồn tin và đối chiếu nhiều nguồn."
        r = self.g(f, guide=guide, votes=1)
        self.assertEqual([y["toi_da"] for y in r["y"]], [0.5, 0.5], "AI tách tiêu chí, quy về đúng tổng điểm")
        n1 = len(f.calls)
        self.g(f, guide=guide, votes=1)
        self.assertEqual(len(f.calls) - n1, 1, "lần sau dùng tiêu chí đã lưu, không tách lại")

    def test_all_votes_fail(self):
        f = Fake(lambda *a: httpx.Response(429, text="quota"))
        with self.assertRaises(LLMError):
            self.g(f)


class Server(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.cfg = Config(agent_key="secret-key", gemini_keys=["k1"], votes=1, db_path=self.tmp.name)
        self.fake = Fake(judge_script(lambda n: [("du", 0.5, "có phải báo chính thống không"), ("khong", 0, "")]))
        self.client = TestClient(create_app(self.cfg, llm=mk_llm(self.fake, keys=["k1"]), store=Store(self.tmp.name)))
        self.H = {"X-Agent-Key": "secret-key"}

    def test_auth(self):
        self.assertEqual(self.client.get("/health").status_code, 200)
        self.assertEqual(self.client.post("/grade", json={"items": [{"text": Q, "max": 1}]}).status_code, 401)
        self.assertEqual(self.client.post("/grade", json={"items": [{"text": Q, "max": 1}]}, headers={"X-Agent-Key": "sai"}).status_code, 401)
        self.assertNotIn("k1", self.client.get("/health").text)

    def test_grade_and_learn_from_teacher(self):
        body = {"title": "Thi thử", "items": [{"text": Q, "guide": G, "answer": A, "max": 1}, {"text": Q, "guide": G, "answer": "", "max": 1}]}
        r = self.client.post("/grade", json=body, headers=self.H)
        self.assertEqual(r.status_code, 200, r.text)
        d = r.json()
        self.assertEqual([i["diem"] for i in d["items"]], [0.5, 0])
        self.assertIn("Phần tự luận: 0,5/2 điểm", d["tong_ket"])
        c = self.client.post("/correct", json={"text": Q, "guide": G, "max": 1, "answer": "Em xem báo chính thống và so sánh nhiều báo.", "score": 1, "note": "đủ 2 ý"}, headers=self.H)
        self.assertEqual(c.status_code, 200)
        self.client.post("/grade", json=body, headers=self.H)
        self.assertIn("VÍ DỤ GIÁO VIÊN ĐÃ CHẤM", self.fake.calls[-1]["prompt"])
        self.assertIn("giáo viên cho 1.0/1.0 điểm", self.fake.calls[-1]["prompt"])
        s = self.client.get("/status", headers=self.H).json()
        self.assertEqual(s["thong_ke"]["vi_du_giao_vien"], 1)
        self.assertGreaterEqual(s["thong_ke"]["cham_24h"], 2)

    def test_errors_map(self):
        cfg = Config(agent_key="x", gemini_keys=["k1"], votes=1, db_path=self.tmp.name)
        f = Fake(lambda *a: httpx.Response(429, text="quota"))
        cl = TestClient(create_app(cfg, llm=mk_llm(f, keys=["k1"]), store=Store(self.tmp.name)))
        r = cl.post("/grade", json={"items": [{"text": Q, "guide": G, "answer": A, "max": 1}]}, headers={"X-Agent-Key": "x"})
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json()["detail"]["kind"], "quota")


class Verify(unittest.TestCase):
    def test_solver_rejects(self):
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        qs = [{"text": "1 byte bằng bao nhiêu bit?", "options": {"A": "4", "B": "8", "C": "16", "D": "2"}, "answer": "B"},
              {"text": "CPU là gì?", "options": {"A": "Bộ xử lý", "B": "Màn hình", "C": "Chuột", "D": "Bàn phím"}, "answer": "C"},
              {"text": "Trùng?", "options": {"A": "x", "B": "x", "C": "y", "D": "z"}, "answer": "A"},
              {"text": "Mơ hồ?", "options": {"A": "1", "B": "2", "C": "3", "D": "4"}, "answer": "A"}]
        f = Fake(lambda m, k, p, n: gemini_ok({"giai": [{"so": 1, "chon": "B"}, {"so": 2, "chon": "A"}, {"so": 3, "chon": "A", "chac_chan": False}]}))
        r = run(verify_questions(mk_llm(f), Store(tmp.name), qs))
        k = r["ket_qua"]
        self.assertTrue(k[0]["giu"])
        self.assertFalse(k[1]["giu"])
        self.assertIn("tự giải ra A, khác đáp án đã ghi C", k[1]["ly_do"])
        self.assertEqual(k[2]["ly_do"], "có phương án trùng nhau")
        self.assertIn("mơ hồ", k[3]["ly_do"])
        self.assertNotIn("Đáp án", f.calls[0]["prompt"], "agent giải không được thấy đáp án")
        self.assertEqual((r["giu"], r["loai"]), (1, 3))


if __name__ == "__main__":
    unittest.main()
