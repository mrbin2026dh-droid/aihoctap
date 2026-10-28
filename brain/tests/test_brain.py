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


def exam20():
    """Đề giả lập 20 em (i = 0 giỏi nhất). 6 câu tốt g1..g6 (đúng nếu i < t) quyết định thứ hạng.
    m: ghi đáp án 'A' nhưng 8 em giỏi nhất chọn 'B' (nghi sai đáp án). e: ai cũng đúng (quá dễ).
    x: đúng ở đúng 2 em mỗi nhóm 5 em (cao, thấp) → D = 0 (phân biệt thấp). Phương án D của g1 không ai chọn."""
    hs = {f"s{i:02d}": {"ten": f"Em {i}", "lop": "9A" if i % 2 == 0 else "9B"} for i in range(20)}
    de = [{"id": f"g{k}", "text": f"Câu tốt {k}", "options": {"A": "đúng", "B": "sai1", "C": "sai2", "D": "sai3"}, "answer": "A", "topic": "T"} for k in range(1, 7)]
    de += [{"id": "m", "text": "Câu nghi sai đáp án", "options": {"A": "đáp án ghi", "B": "đáp án thật"}, "answer": "A", "topic": "T"},
           {"id": "e", "text": "Câu quá dễ", "options": {"A": "x", "B": "y"}, "answer": "A", "topic": "T"},
           {"id": "x", "text": "Câu phân biệt thấp", "options": {"A": "x", "B": "y"}, "answer": "A", "topic": "T"}]
    nop = {}
    for i in range(20):
        tl = {f"g{k}": ("A" if i < t else ("B" if i % 2 else "C")) for k, t in zip(range(1, 7), (14, 13, 12, 11, 10, 9))}
        tl["m"] = "B" if i < 8 else "A"
        tl["e"] = "A"
        tl["x"] = "A" if i in (0, 1, 17, 18) else "B"
        nop[f"s{i:02d}"] = {"diem": 1, "tong": 9, "tra_loi": tl}
    return {"thi_hs": hs, "nang_luc": {}, "doc_read": {}, "thi_bai": {"t9": {"tieu_de": "Thi thử chương 1", "che_do": "thu"}}, "thi_nop": {"t9": nop}, "thi_de": {"t9": de}}


class ItemAnalysis(unittest.TestCase):
    def setUp(self):
        self.db = store.open_db(":memory:")
        store.snapshot(self.db, "2026-10-28", exam20())
        self.items = {it["cau"]: it for it in analyze.item_analysis(self.db, "t9")}

    def tearDown(self):
        self.db.close()

    def test_good_item_no_issue(self):
        g = self.items["Câu tốt 3"]   # đúng nếu i < 12: nhóm cao (5 em) đúng hết, nhóm thấp sai hết
        self.assertEqual((g["ti_le_dung"], g["do_phan_biet"]), (60, 1.0))
        self.assertEqual(g["muc"], 1); self.assertEqual(len(g["van_de"]), 1)   # chỉ nhắc phương án D không ai chọn

    def test_miskey_detected(self):
        m = self.items["Câu nghi sai đáp án"]
        self.assertEqual(m["muc"], 3)
        # Câu sai đáp án trừ điểm chính các em giỏi → một em chọn "đáp án ghi" lọt vào nhóm cao (4 so với 1), vẫn phát hiện
        self.assertIn("“đáp án thật” (4 em) nhiều hơn đáp án đang ghi “đáp án ghi” (1 em)", m["van_de"][0])

    def test_easy_and_low_discrimination(self):
        self.assertEqual(self.items["Câu quá dễ"]["muc"], 1); self.assertIn("quá dễ (100% đúng)", self.items["Câu quá dễ"]["van_de"][0])
        x = self.items["Câu phân biệt thấp"]   # câu khó: nhóm cao chọn B (3) nhiều hơn A (2) nhưng nhóm thấp chọn B còn nhiều hơn (4) → KHÔNG nghi sai đáp án
        self.assertEqual((x["ti_le_dung"], x["do_phan_biet"], x["muc"]), (20, 0.2, 2))
        self.assertEqual(x["van_de"], ["quá khó (20% đúng)"])

    def test_low_discrimination(self):
        db = store.open_db(":memory:")   # 10 em, 5 câu neo (đúng nếu i < t) quyết định thứ hạng; câu y đúng ở s0, s5, s9
        de = [{"id": f"a{k}", "text": f"Neo {k}", "options": {"A": "đ", "B": "s"}, "answer": "A"} for k in range(5)]
        de.append({"id": "y", "text": "Câu y", "options": {"A": "đ", "B": "s"}, "answer": "A"})
        nop = {f"s{i}": {"diem": 1, "tong": 6, "tra_loi": {**{f"a{k}": ("A" if i < t else "B") for k, t in enumerate((8, 7, 6, 5, 4))}, "y": "A" if i in (0, 5, 9) else "B"}} for i in range(10)}
        store.snapshot(db, "2026-10-28", {"thi_hs": {f"s{i}": {"ten": str(i), "lop": "9A"} for i in range(10)}, "thi_nop": {"t": nop}, "thi_de": {"t": de}, "thi_bai": {"t": {"tieu_de": "T", "che_do": "thu"}}})
        y = next(it for it in analyze.item_analysis(db, "t") if it["cau"] == "Câu y")
        # nhóm cao (3 em) = s0, s1, s2 → 1/3 đúng; nhóm thấp = s7, s9, s8 → 1/3 đúng → D = 0; p = 30%
        self.assertEqual((y["ti_le_dung"], y["do_phan_biet"], y["muc"]), (30, 0.0, 2))
        self.assertIn("độ phân biệt thấp (D = 0.00)", y["van_de"][0])
        db.close()

    def test_dead_distractor(self):
        self.assertTrue(any("không em nào chọn: “sai3”" in v for v in self.items["Câu tốt 1"]["van_de"]))
        self.assertEqual(self.items["Câu tốt 1"]["muc"], 1)

    def test_class_quality_list(self):
        q = analyze.class_facts(self.db, "9A", "2026-10-28")["chat_luong_cau_hoi"]
        self.assertEqual([c["cau"] for c in q][0], "Câu nghi sai đáp án")   # nặng nhất lên đầu
        self.assertNotIn("Câu quá dễ", [c["cau"] for c in q])   # mức 1 không đưa vào báo cáo
        self.assertTrue(all(c["de"] == "Thi thử chương 1" and c["so_em"] == 20 for c in q))   # thống kê trên cả 2 lớp
        self.assertIn("Chất lượng câu hỏi", report.fallback_md(analyze.class_facts(self.db, "9A", "2026-10-28")))

    def test_diagnose_no_names(self):
        txt = "\n".join(analyze.diagnose(self.db))
        self.assertIn("20 em có câu trả lời, 9 câu trắc nghiệm", txt)
        self.assertIn("Câu nghi sai đáp án (bị loại khỏi hiểu lầm): 1", txt)
        self.assertIn("không khớp câu hỏi trong đề: 0; không khớp học sinh trong danh sách: 0; lựa chọn không có trong phương án: 0", txt)
        self.assertNotIn("s0", txt.replace("s0 ", "")); self.assertNotIn("Em ", txt)

    def test_mismatched_question_ids_ignored(self):
        d = exam20()   # thêm 30 bài nộp mang mã câu không có trong đề → không được làm sai lệch tỉ lệ đúng
        for i in range(30):
            d["thi_nop"]["t9"][f"z{i:02d}"] = {"diem": 0, "tong": 9, "tra_loi": {"tin9_b1_q1": "A", "tin9_b1_q2": "B"}}
        db = store.open_db(":memory:"); store.snapshot(db, "2026-10-28", d)
        g = {it["cau"]: it for it in analyze.item_analysis(db, "t9")}["Câu tốt 3"]
        self.assertEqual((g["so_em"], g["ti_le_dung"], g["do_phan_biet"]), (20, 60, 1.0))
        self.assertIn("không khớp câu hỏi trong đề: 60", "\n".join(analyze.diagnose(db)))
        db.close()

    def test_too_few_students(self):
        self.assertEqual(analyze.item_analysis(self.db, "t9", min_n=21), [])


class Personal(unittest.TestCase):
    def test_personal_misconceptions(self):
        db = store.open_db(":memory:")
        d = exam20()
        d["thi_hs"]["s19"] = {"ten": "Em 19", "lop": "9B"}
        store.snapshot(db, "2026-10-28", d)
        hl = analyze.personal_misconceptions(db)
        every = [x for v in hl.values() for x in v]
        self.assertFalse(any(x["cau"] == "Câu nghi sai đáp án" for x in every), "câu nghi sai đáp án: không nói em chọn 'sai' (có thể em đúng)")
        self.assertNotIn("s00", hl)   # s00 chỉ "sai" ở câu nghi sai đáp án → không có hiểu lầm nào
        s19 = hl["s19"]
        self.assertEqual(len(s19), 3)
        self.assertTrue(all(set(x) == {"cau", "chon", "chu_de"} for x in s19))
        self.assertFalse(any(x["chon"] in ("đúng", "x") for x in every), "không bao giờ là đáp án đúng")
        self.assertEqual(s19[0], {"cau": "Câu phân biệt thấp", "chon": "y", "chu_de": "T"})   # lỗi nhiều bạn cùng mắc nhất (16 em) lên trước
        self.assertEqual(analyze.class_facts(db, "9A", "2026-10-28")["hieu_lam"][0]["cau"], "Câu phân biệt thấp")
        self.assertNotIn("Câu nghi sai đáp án", [h["cau"] for h in analyze.class_facts(db, "9A", "2026-10-28")["hieu_lam"]])
        db.close()


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
        fb = fixture_day({"a": topics(mnp=("Mã nhị phân", 2, 10))}, nop={"a": {"diem": 2, "tong": 10, "lan": 1, "tra_loi": {"q1": "A"}}})
        fb["thi_de"] = {"t1": [{"id": "q1", "text": "1 byte bằng bao nhiêu bit?", "options": {"A": "4", "B": "8"}, "answer": "B", "topic": "Đơn vị"}]}
        seen = {"sheet": None, "auth": [], "brain": [], "gem": 0, "hl": [], "hl_key": []}

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
                if self.path == "/api/brain/hieu-lam":
                    seen["hl"].append(body); seen["hl_key"].append(self.headers.get("X-Brain-Key"))
                    return self._send({"saved": len(body["items"]), "cleared": 0, "skipped": 0})
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
                self.assertEqual(main(["run", "--dry-run", "--env", env]), 0)
                self.assertEqual(seen["hl"], [], "chạy thử: không gửi Gia sư")
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
        self.assertEqual(seen["hl_key"], ["kb", "kb"])
        self.assertEqual(seen["hl"][-1], {"items": {"a": [{"cau": "1 byte bằng bao nhiêu bit?", "chon": "4", "chu_de": "Đơn vị"}]}}, "gửi lựa chọn sai, KHÔNG có đáp án đúng, không có tên")
        self.assertFalse(any("An" in json.loads(p)["contents"][0]["parts"][0]["text"].split("SỐ LIỆU")[1] for p in seen["prompts"]), "không gửi tên học sinh cho Gemini")


if __name__ == "__main__":
    unittest.main()
