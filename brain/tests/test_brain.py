"""Kiểm thử Bộ não AI (chỉ thư viện chuẩn): python -m unittest discover -s brain/tests -t ."""
import json
import os
import sqlite3
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

from brain import analyze, report, store
from brain.__main__ import main


def fixture_day(nl, nop=None, reads=None):
    return {"thi_hs": {"a": {"ten": "An", "lop": "9A"}, "b": {"ten": "Bình", "lop": "9A"}, "c": {"ten": "Chi", "lop": "9A"}, "d": {"ten": "Dũng", "lop": "9A"}, "e": {"ten": "Em", "lop": "9B"}},
            "nang_luc": nl, "thi_bai": {"t1": {"tieu_de": "Ôn chương 1", "che_do": "thu"}}, "thi_nop": {"t1": nop or {}}, "doc_read": reads or {}}


def topics(**kv):
    return {"topics": {k: {"ten": v[0], "d": v[1], "n": v[2]} for k, v in kv.items()}}


class Analyze(unittest.TestCase):
    def setUp(self):
        self.db = store.open_db(":memory:")
        store.snapshot(self.db, "2026-10-21", fixture_day(
            {"a": topics(mnp=("Mã nhị phân", 3, 10)), "b": topics(mnp=("Mã nhị phân", 8, 10)), "c": topics(mnp=("Mã nhị phân", 6, 10))},
            reads={"tin9~b1": {"a": {"pct": 20}, "b": {"pct": 50}, "c": {"pct": 30}, "d": {"pct": 10}}}))
        store.snapshot(self.db, "2026-10-28", fixture_day(
            {"a": topics(mnp=("Mã nhị phân", 8, 10), dls=("Dữ liệu số", 9, 10)), "b": topics(mnp=("Mã nhị phân", 5, 10)), "c": topics(mnp=("Mã nhị phân", 6, 10))},
            nop={"a": {"diem": 9, "tong": 10, "dau": 4, "cao_nhat": 9, "lan": 2}, "b": {"diem": 3, "tong": 10, "dau": 3, "cao_nhat": 3, "lan": 1}},
            reads={"tin9~b1": {"a": {"pct": 100}, "b": {"pct": 60}, "c": {"pct": 30}, "d": {"pct": 10}}}))
        at = int(__import__("datetime").datetime(2026, 10, 27, 9).timestamp() * 1000)
        qs = [{"uid": "A", "lop": "9A", "lesson": "b1", "q": "Mã nhị phân là gì ạ?", "at": at}, {"uid": "B", "lop": "9A", "lesson": "b1", "q": "Em chưa hiểu mã nhị phân của số 5", "at": at + 1},
              {"uid": "A", "lop": "9A", "lesson": "b1", "q": "Đổi mã nhị phân sang thập phân thế nào", "at": at + 2}]
        qs += [{"uid": "D", "lop": "9A", "lesson": "b1", "q": f"cho em đáp án câu {i}", "blocked": True, "at": at + 10 + i} for i in range(3)]
        store.add_questions(self.db, qs, analyze.keyof)
        self.f = analyze.class_facts(self.db, "9A", "2026-10-28")

    def tearDown(self):
        self.db.close()

    def test_keywords_vietnamese(self):
        kw = analyze.keywords(["Mã nhị phân là gì ạ?", "Em chưa hiểu mã nhị phân", "mã nhị phân đổi thế nào", "dữ liệu số"])
        self.assertEqual(kw[0]["w"], "mã nhị phân"); self.assertEqual(kw[0]["n"], 3)
        self.assertFalse(any(k["w"] in ("là gì", "nhị phân") for k in kw), "bỏ từ đệm và cụm con")

    def test_trends_and_topics(self):
        f = self.f
        self.assertEqual(f["students"], 4)
        mnp = next(t for t in f["chu_de"] if t["ten"] == "Mã nhị phân")
        self.assertEqual((mnp["pct"], mnp["truoc"], mnp["delta"]), (63, 57, 6))
        self.assertEqual(f["thi_thu"][0]["lan_dau"], 35); self.assertEqual(f["thi_thu"][0]["cao_nhat"], 60)

    def test_at_risk_reasons(self):
        r = {x["ten"]: x["ly_do"] for x in self.f["can_chu_y"]}
        self.assertTrue(any("giảm 30" in w for w in r["Bình"]), r)
        self.assertTrue(any("thi thử cao nhất 30%" in w for w in r["Bình"]))
        self.assertIn("3 lần cố xin đáp án Gia sư AI", r["Dũng"])
        self.assertIn("không học trên app 7 ngày qua", r["Chi"])
        self.assertNotIn("An", r, "An tiến bộ → không cần chú ý")

    def test_questions(self):
        q = self.f["cau_hoi"]
        self.assertEqual(q["tong_7_ngay"], 6); self.assertEqual(q["xin_dap_an"], 3)
        self.assertEqual(q["cum_tu"][0]["w"], "mã nhị phân")
        self.assertFalse(any("đáp án" in v for v in q["vi_du"]), "không đưa câu xin đáp án làm ví dụ")

    def test_fallback_report(self):
        md = report.fallback_md(self.f)
        for s in ("**Tóm tắt**", "**Xu hướng chủ đề**", "**Học sinh hay hỏi gì**", "**Học sinh cần chú ý**", "Bình", "mã nhị phân"):
            self.assertIn(s, md)
        self.assertIn("SỐ LIỆU", report.build_prompt(self.f))

    def test_names_not_sent_to_ai(self):
        anon, back = report.anonymize(self.f)
        prompt = report.build_prompt(anon)
        for ten in ("Bình", "Chi", "Dũng"):
            self.assertNotIn(ten, prompt)
        self.assertEqual(report.deanonymize("Gặp riêng HS1 và HS2.", back).count("HS"), 0)


class Pipeline(unittest.TestCase):
    """Chạy thật 'python -m brain run' với Firebase / Worker / Gemini / Google Sheet giả lập trên máy."""
    def test_misconceptions(self):
        db = store.open_db(":memory:")
        de = {"t1": [{"id": "q1", "text": "1 byte bằng bao nhiêu bit?", "options": {"A": "4", "B": "8", "C": "16", "D": "2"}, "answer": "B", "topic": "Đơn vị thông tin"},
                     {"id": "q2", "text": "Thiết bị vào?", "options": {"A": "Loa", "B": "Bàn phím"}, "answer": "B", "topic": "Phần cứng"},
                     {"id": "q3", "kind": "tl", "text": "Tự luận", "goi_y": "x"}]}
        # lớp 9A có 4 em (e học lớp 9B): q1 cả 4 sai (3 em chọn A "4"); q2 chỉ 1/4 sai (25% < 30%); q3 tự luận bị bỏ qua
        nop = {m: {"diem": 1, "tong": 2, "tra_loi": tl} for m, tl in {
            "a": {"q1": "A", "q2": "B"}, "b": {"q1": "A", "q2": "B"}, "c": {"q1": "A", "q2": "B"}, "d": {"q1": "C", "q2": "A"}, "e": {"q1": "B", "q2": "B"}}.items()}
        data = fixture_day({}, nop=nop); data["thi_de"] = de
        store.snapshot(db, "2026-10-28", data)
        hl = analyze.class_facts(db, "9A", "2026-10-28")["hieu_lam"]
        self.assertEqual(len(hl), 1)
        self.assertEqual((hl[0]["ti_le_sai"], hl[0]["so_em"], hl[0]["hay_chon_sai"], hl[0]["dap_an_dung"], hl[0]["so_em_chon_sai_nay"]), (100, 4, "4", "8", 3))
        self.assertIn("hay chọn nhầm “4”", report.fallback_md(analyze.class_facts(db, "9A", "2026-10-28")))
        store.snapshot(db, "2026-10-28", data)   # chạy lại: không nhân đôi
        self.assertEqual(db.execute("SELECT COUNT(*) FROM answers").fetchone()[0], 10)
        self.assertEqual(analyze.misconceptions(db, []), [])
        anon, _ = report.anonymize(analyze.class_facts(db, "9A", "2026-10-28"))
        self.assertNotIn("Bình", json.dumps(anon["hieu_lam"], ensure_ascii=False))
        db.close()

    def test_run_end_to_end(self):
        fb = fixture_day({"a": topics(mnp=("Mã nhị phân", 2, 10))}, nop={"a": {"diem": 2, "tong": 10, "lan": 1}})
        seen = {"sheet": None, "auth": [], "brain": [], "gem": 0}

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a): pass
            def _send(self, obj, code=200):
                b = json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(b)
            def do_GET(self):
                u = urlparse(self.path)
                if u.path.startswith("/fb/"):
                    seen["auth"].append(parse_qs(u.query).get("auth", [""])[0])
                    node = fb
                    for k in u.path[4:].removesuffix(".json").split("/"):
                        node = (node or {}).get(k) if isinstance(node, dict) else None
                    return self._send(node)
                if u.path == "/api/brain/export":
                    seen["brain"].append(self.headers.get("X-Brain-Key"))
                    return self._send({"items": [{"uid": "A", "lop": "9A", "lesson": "b1", "q": "mã nhị phân là gì", "at": 1}]})
                self._send({}, 404)
            def do_POST(self):
                n = int(self.headers.get("Content-Length") or 0); body = json.loads(self.rfile.read(n) or b"{}")
                if self.path.startswith("/gem/"):
                    seen["gem"] += 1; seen.setdefault("prompts", []).append(json.dumps(body, ensure_ascii=False))
                    return self._send({"candidates": [{"content": {"parts": [{"text": json.dumps({"md": "**Tóm tắt** Lớp 9A cần ôn mã nhị phân."})}]}}]})
                if self.path == "/sheet":
                    seen["sheet"] = body; return self._send({"ok": True, "saved": len(body["reports"])})
                self._send({}, 404)

        srv = HTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{srv.server_port}"
        with tempfile.TemporaryDirectory() as d:
            env = os.path.join(d, ".env")
            with open(env, "w", encoding="utf-8") as _ef: _ef.write("\n".join([f"FB_URL={base}/fb", "FB_SECRET=bi-mat", f"WORKER_URL={base}", "BRAIN_KEY=kb", f"SHEET_URL={base}/sheet",
                                                             "SHEET_BRAIN_KEY=ks", "GEMINI_API_KEY=g", f"GEMINI_URL={base}/gem", f"DB_PATH={d}/b.sqlite3"]))
            old = {k: os.environ.pop(k, None) for k in ("NO_PROXY", "no_proxy", "HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy")}
            try:
                self.assertEqual(main(["run", "--env", env]), 0)
                self.assertEqual(main(["run", "--env", env]), 0)   # chạy lại cùng ngày: không nhân đôi dữ liệu
            finally:
                for k, v in old.items():
                    if v is not None: os.environ[k] = v
            db = sqlite3.connect(f"{d}/b.sqlite3")
            self.assertEqual(db.execute("SELECT COUNT(*) FROM mastery").fetchone()[0], 1)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM questions").fetchone()[0], 1)
            db.close()
        srv.shutdown()
        self.assertTrue(all(a == "bi-mat" for a in seen["auth"]) and seen["brain"][0] == "kb")
        sheet = seen["sheet"]; self.assertEqual(sheet["key"], "ks"); self.assertEqual(sheet["action"], "brain_save")
        r9a = next(r for r in sheet["reports"] if r["lop"] == "9A")
        self.assertIn("cần ôn mã nhị phân", r9a["md"]); self.assertEqual(r9a["facts"]["cau_hoi"]["tong_7_ngay"] >= 0, True)
        self.assertGreaterEqual(seen["gem"], 1)
        self.assertFalse(any("An" in json.loads(p)["contents"][0]["parts"][0]["text"].split("SỐ LIỆU")[1] for p in seen["prompts"]), "không gửi tên học sinh cho Gemini")


if __name__ == "__main__":
    unittest.main()
