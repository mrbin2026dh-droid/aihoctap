"""Sinh database.rules.merged.json = 7 nhánh ứng dụng cũ + luật thi v2 (nguồn duy nhất: database.rules.v2.json).
Nhánh cũ: vẫn mở cho tài khoản của ứng dụng cũ, nhưng CHẶN tài khoản học sinh/giáo viên hệ thống thi mới
(email @hs.aihoc.test) để học sinh không đọc/ghi được ngân hàng câu hỏi, giáo án, phòng học cũ.
Chạy: python3 spike/step0/build_merged.py  (rồi chạy emulator test, rồi firebase deploy --only database)"""
import json, pathlib
here = pathlib.Path(__file__).parent
LEGACY = ['rooms', 'remoteCommand', 'activeSession', 'lessons', 'sessionHistory', 'lessonPlans', 'questionBank']
# Chặn thêm vé do Worker cấp (custom token có claim role: học sinh/giáo viên của app mới, không có email).
NOT_EXAM_ACCOUNT = "auth != null && auth.token.role == null && (auth.token.email == null || !auth.token.email.endsWith('@hs.aihoc.test'))"
v2 = json.loads((here / 'database.rules.v2.json').read_text(encoding='utf-8'))['rules']
rules = {k: {'.read': NOT_EXAM_ACCOUNT, '.write': NOT_EXAM_ACCOUNT} for k in LEGACY}
rules.update(v2)
(here / 'database.rules.merged.json').write_text(json.dumps({'rules': rules}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Đã ghi database.rules.merged.json:', len(LEGACY), 'nhánh cũ (chặn @hs.aihoc.test) +', len(v2), 'nhánh thi v2')
