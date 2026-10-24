#!/usr/bin/env python3
"""
Upload Private Question Packages to Firebase Realtime Database (J2/K2)
Reads raw curriculum files from a backup directory OUTSIDE the repository,
extracts minimal answer keys (id + correct_answer), validates IDs with:
ID_PATTERN = ^[A-Za-z0-9_-]{1,64}$
and uploads to:
/packages_private/${course_id}:${lesson_id}.json
via Firebase REST API with OAuth2 Service Account Access Token.
"""

import os
import sys
import re
import json
import time
import argparse
import urllib.request
import urllib.parse

# Ensure utf-8 stdout on Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Safe ID Regex Invariant (matching Worker IdValidationContract H1/I4/K2)
ID_PATTERN = re.compile(r'^[A-Za-z0-9_-]{1,64}$')

def is_valid_id(val) -> bool:
    """Validates ID against Safe ID Regex Invariant: ^[A-Za-z0-9_-]{1,64}$."""
    if val is None:
        return False
    if not isinstance(val, (str, int)):
        return False
    s = str(val).strip()
    return bool(ID_PATTERN.match(s))

def mint_oauth_token(service_account_path):
    """Mints Google OAuth2 access token from service account JSON using PyJWT or manual assertion."""
    with open(service_account_path, 'r', encoding='utf-8') as f:
        sa = json.load(f)
    
    try:
        import jwt # PyJWT with cryptography
    except ImportError:
        print("[ERROR] Cần cài đặt pyjwt và cryptography để tạo OAuth token: pip install pyjwt cryptography")
        sys.exit(1)

    now = int(time.time())
    payload = {
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/firebase.database",
        "aud": "https://oauth2.googleapis.com/token",
        "exp": now + 3600,
        "iat": now
    }
    
    encoded_jwt = jwt.encode(payload, sa["private_key"], algorithm="RS256")
    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": encoded_jwt
    }).encode("utf-8")

    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req) as response:
        res_json = json.loads(response.read().decode("utf-8"))
        return res_json["access_token"]

def build_private_packages(backup_dir):
    """Scans backup_dir for curriculum JSON files and extracts answer packages with strict ID validation."""
    packages = []
    seen_pkg_ids = set()

    for root, _, files in os.walk(backup_dir):
        for f in files:
            if f.endswith('.json'):
                path = os.path.join(root, f)
                try:
                    with open(path, 'r', encoding='utf-8') as fp:
                        raw_json = json.load(fp)
                except Exception as e:
                    print(f"[WARN] Bỏ qua file lỗi {path}: {e}")
                    continue

                if not isinstance(raw_json, dict):
                    continue

                items = raw_json.get('exams') if isinstance(raw_json.get('exams'), list) else [raw_json]
                for data in items:
                    if not isinstance(data, dict):
                        continue

                    # K2: Robust course_id derivation (supporting explicit course_id, directory, grade alias)
                    rel = os.path.relpath(path, backup_dir).replace('\\', '/')
                    parts = [p for p in rel.split('/') if p]

                    course_ids = set()
                    raw_course = data.get('course_id') or data.get('subject_id')
                    if is_valid_id(raw_course):
                        course_ids.add(str(raw_course).strip())

                    # Derive from path if missing or valid folder candidate
                    if len(parts) >= 2 and is_valid_id(parts[-2]):
                        course_ids.add(parts[-2])

                    # Grade-based alias (e.g. grade 6 -> tin6, grade 9 -> tin9)
                    grade = data.get('grade')
                    if grade is not None:
                        g_slug = f"tin{grade}"
                        if is_valid_id(g_slug):
                            course_ids.add(g_slug)

                    # Only accept data.get('subject') if it strictly conforms to ID_PATTERN
                    if not course_ids:
                        sub = data.get('subject')
                        if is_valid_id(sub):
                            course_ids.add(str(sub).strip())

                    # K2: Robust lesson_id derivation
                    lesson_ids = set()
                    raw_lesson = data.get('lesson_id') if data.get('lesson_id') is not None else (data.get('id') or data.get('exam_id'))
                    if is_valid_id(raw_lesson):
                        lesson_ids.add(str(raw_lesson).strip())

                    # Filename stem candidate (e.g. 'bai1' or 'exam_tin6_15p_b1_b2')
                    file_stem = os.path.splitext(os.path.basename(path))[0].strip()
                    if is_valid_id(file_stem) and file_stem != 'default_exams':
                        lesson_ids.add(file_stem)

                    # Validation gatekeeper
                    valid_cids = [c for c in course_ids if is_valid_id(c)]
                    valid_lids = [l for l in lesson_ids if is_valid_id(l)]
                    if not valid_cids or not valid_lids:
                        print(f"[WARN] Bỏ qua file {path}: course_ids '{course_ids}' hoặc lesson_ids '{lesson_ids}' không hợp lệ (không khớp ^[A-Za-z0-9_-]{{1,64}}$).")
                        continue

                    raw_questions = data.get('quiz') or data.get('questions') or []
                    if not raw_questions or not isinstance(raw_questions, list):
                        continue

                    extracted_questions = []
                    for q in raw_questions:
                        if not isinstance(q, dict):
                            continue
                        qid = str(q.get('id') or '').strip()
                        ans = (
                            q.get('dap_an_dung')
                            or q.get('correct_answer')
                            or q.get('dap_an')
                            or q.get('answer')
                            or q.get('correct')
                            or q.get('answer_key')
                            or q.get('ket_qua')
                        )
                        if is_valid_id(qid) and ans is not None:
                            extracted_questions.append({
                                "id": qid,
                                "correct_answer": ans
                            })

                    if not extracted_questions:
                        continue

                    for cid in valid_cids:
                        for lid in valid_lids:
                            pkg_id = f"{cid}:{lid}"
                            if pkg_id not in seen_pkg_ids:
                                seen_pkg_ids.add(pkg_id)
                                packages.append({
                                    "package_id": pkg_id,
                                    "course_id": cid,
                                    "lesson_id": lid,
                                    "total_questions": len(extracted_questions),
                                    "questions": extracted_questions,
                                    "updated_at": int(time.time() * 1000)
                                })

    return packages

def upload_package(database_url, package, access_token, dry_run=False):
    package_id = package["package_id"]
    safe_pkg_id = urllib.parse.quote(package_id, safe='')
    url = f"{database_url.rstrip('/')}/packages_private/{safe_pkg_id}.json"
    
    if dry_run:
        print(f"[DRY-RUN] Sẽ nạp gói: {package_id} ({package['total_questions']} câu hỏi) -> {url}")
        return True

    payload = json.dumps(package).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="PUT")
    req.add_header("Authorization", f"Bearer {access_token}")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status in (200, 204):
                print(f"[SUCCESS] Đã nạp thành công: {package_id}")
                return True
            else:
                print(f"[FAIL] Lỗi nạp {package_id}: HTTP {resp.status}")
                return False
    except Exception as e:
        print(f"[ERROR] Ngoại lệ khi nạp {package_id}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Upload private question packages to Firebase RTDB")
    parser.add_argument("--backup-dir", required=True, help="Thư mục sao lưu chứa dữ liệu gốc có đáp án (ngoài repo)")
    parser.add_argument("--database-url", default=os.getenv("FIREBASE_DATABASE_URL"), help="URL Firebase Realtime Database")
    parser.add_argument("--service-account", default=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"), help="Đường dẫn file serviceAccountKey.json")
    parser.add_argument("--dry-run", action="store_true", help="Chạy thử nghiệm không gửi request mạng")

    args = parser.parse_args()

    if not os.path.exists(args.backup_dir):
        print(f"[ERROR] Không tìm thấy thư mục: {args.backup_dir}")
        sys.exit(1)

    packages = build_private_packages(args.backup_dir)
    print(f"[*] Tìm thấy {len(packages)} gói câu hỏi hợp lệ trong {args.backup_dir}")

    if not packages:
        print("[!] Không có gói câu hỏi nào để nạp.")
        sys.exit(0)

    if args.dry_run:
        for pkg in packages:
            upload_package("https://example.firebaseio.com", pkg, "mock_token", dry_run=True)
        print("[*] Hoàn tất chế độ chạy thử (Dry Run).")
        sys.exit(0)

    if not args.database_url:
        print("[ERROR] Thiếu --database-url hoặc biến môi trường FIREBASE_DATABASE_URL")
        sys.exit(1)

    if not args.service_account or not os.path.exists(args.service_account):
        print("[ERROR] Thiếu --service-account hợp lệ để tạo access token")
        sys.exit(1)

    access_token = mint_oauth_token(args.service_account)
    print("[*] Đã tạo OAuth2 Access Token thành công.")

    success_count = 0
    for pkg in packages:
        if upload_package(args.database_url, pkg, access_token):
            success_count += 1

    print(f"\n[HOÀN TẤT] Nạp thành công {success_count}/{len(packages)} gói đáp án vào RTDB packages_private.")

if __name__ == "__main__":
    main()
