#!/usr/bin/env python3
"""
Quản lý Tài khoản Học sinh trên Firebase Realtime Database (L1/L2, M4)
Tạo, cập nhật và đồng bộ danh sách học sinh vào /students_auth/${student_id}.json
Bảo mật:
- PIN được băm bằng PBKDF2-HMAC-SHA256 (100.000 vòng lặp) kèm Salt ngẫu nhiên 32 hex chars.
- Tuyệt đối không lưu PIN dạng bản rõ (plaintext) trên cơ sở dữ liệu.
- Tự động sinh mã PIN ngẫu nhiên 6 chữ số an toàn.
- Xuất bảng phân công mã PIN ra tệp bảo mật bên ngoài repo (không lưu trong repo công khai).
- Xác thực REST API bằng Google OAuth2 Service Account Access Token.
"""

import os
import sys
import re
import csv
import json
import time
import secrets
import hashlib
import argparse
import urllib.request
import urllib.parse
from typing import Dict, Any, Optional, List

# Ensure utf-8 stdout on Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Safe ID Regex Invariant (matching Worker IdValidationContract H1/I4/K2)
ID_PATTERN = re.compile(r'^[A-Za-z0-9_-]{1,64}$')

# M4: Do not hardcode project database URL; read from environment variable
DEFAULT_DATABASE_URL = os.environ.get("FIREBASE_DATABASE_URL", "")

def is_valid_id(val: Any) -> bool:
    """Validates ID against Safe ID Regex Invariant: ^[A-Za-z0-9_-]{1,64}$."""
    if val is None:
        return False
    if not isinstance(val, (str, int)):
        return False
    s = str(val).strip()
    return bool(ID_PATTERN.match(s))

def generate_secure_pin() -> str:
    """Generates a cryptographically secure random 6-digit numeric PIN (M3/M4)."""
    return f"{secrets.randbelow(900000) + 100000}"

def hash_pin_pbkdf2(pin: str, salt_hex: str) -> str:
    """Computes PBKDF2-HMAC-SHA256 hash matching Worker hashPinPbkdf2 (100,000 iterations)."""
    salt_bytes = bytes.fromhex(salt_hex)
    derived = hashlib.pbkdf2_hmac('sha256', pin.encode('utf-8'), salt_bytes, 100000)
    return derived.hex()

def create_student_auth_record(student_id: str, name: str, grade: int, class_code: str, pin: Optional[str] = None, salt: Optional[str] = None) -> Dict[str, Any]:
    """Creates a validated student record with unique salt and PBKDF2 pin hash (M3/M4)."""
    if not is_valid_id(student_id):
        raise ValueError(f"Mã học sinh '{student_id}' không hợp lệ (phải từ 1-64 ký tự chữ, số hoặc dấu gạch, cấm ký tự đặc biệt).")
    
    clean_pin = str(pin).strip() if pin else generate_secure_pin()
    if len(clean_pin) < 6:
        raise ValueError("Mã PIN học sinh phải có độ dài tối thiểu 6 ký tự (M3).")

    if not salt:
        salt = secrets.token_hex(16) # 32 hex chars

    pin_hash = hash_pin_pbkdf2(clean_pin, salt)

    return {
        "student_id": str(student_id).strip(),
        "name": str(name).strip(),
        "grade": int(grade),
        "class_code": str(class_code).strip().upper(),
        "salt": salt,
        "pin_hash": pin_hash,
        "raw_pin": clean_pin
    }

def export_credentials_csv(records: List[Dict[str, Any]], out_path: str):
    """Exports credentials roster (student_id, name, grade, class_code, pin) to a secure file outside repo (M4)."""
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["student_id", "name", "grade", "class_code", "pin"])
        for r in records:
            writer.writerow([r["student_id"], r["name"], r["grade"], r["class_code"], r.get("raw_pin", "")])
    print(f"[EXPORT] Đã xuất bảng phân bổ mã PIN an toàn tới: {out_path}")

def mint_oauth_token(service_account_path: str) -> str:
    """Mints Google OAuth2 access token from service account JSON using PyJWT."""
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

def upload_student(database_url: str, token: str, record: Dict[str, Any]) -> bool:
    """Uploads single student auth record to RTDB /students_auth/${student_id}.json."""
    if not database_url:
        raise ValueError("Chưa cấu hình URL Firebase RTDB (thiếu --database-url hoặc biến FIREBASE_DATABASE_URL).")
    
    student_id = record["student_id"]
    safe_id = urllib.parse.quote(student_id, safe='')
    url = f"{database_url.rstrip('/')}/students_auth/{safe_id}.json"
    
    payload = {
        "name": record["name"],
        "grade": record["grade"],
        "class_code": record["class_code"],
        "salt": record["salt"],
        "pin_hash": record["pin_hash"]
    }
    
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='PUT')
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status in (200, 204)
    except Exception as e:
        print(f"[ERROR] Thất bại khi tải học sinh {student_id}: {e}")
        return False

def list_students(database_url: str, token: str) -> List[Dict[str, Any]]:
    """Fetches list of students from RTDB /students_auth.json."""
    if not database_url:
        raise ValueError("Chưa cấu hình URL Firebase RTDB (thiếu --database-url hoặc biến FIREBASE_DATABASE_URL).")
    
    url = f"{database_url.rstrip('/')}/students_auth.json?shallow=false"
    req = urllib.request.Request(url, method='GET')
    req.add_header('Authorization', f'Bearer {token}')
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if not data or not isinstance(data, dict):
                return []
            result = []
            for sid, val in data.items():
                if isinstance(val, dict):
                    result.append({
                        "student_id": sid,
                        "name": val.get("name", ""),
                        "grade": val.get("grade", ""),
                        "class_code": val.get("class_code", "")
                    })
            return result
    except Exception as e:
        print(f"[ERROR] Lỗi khi đọc danh sách học sinh: {e}")
        return []

def main():
    parser = argparse.ArgumentParser(description="Quản lý Tài khoản Học sinh Firebase Realtime Database (L1/L2, M4)")
    subparsers = parser.add_subparsers(dest="action", required=True)

    # Subcommand: add
    p_add = subparsers.add_parser("add", help="Thêm hoặc cập nhật một học sinh")
    p_add.add_argument("--id", required=True, help="Mã định danh học sinh (vd: hs01, 123456)")
    p_add.add_argument("--name", required=True, help="Họ và tên học sinh")
    p_add.add_argument("--grade", type=int, required=True, choices=[6, 7, 8, 9, 10, 11, 12], help="Khối lớp (6-12)")
    p_add.add_argument("--class-code", required=True, help="Mã lớp (vd: 6A, 9B)")
    p_add.add_argument("--pin", help="Mã PIN (tối thiểu 6 ký tự). Nếu bỏ qua, hệ thống tự sinh mã PIN ngẫu nhiên 6 chữ số.")
    p_add.add_argument("--service-account", help="Đường dẫn tệp service account JSON")
    p_add.add_argument("--database-url", default=DEFAULT_DATABASE_URL, help="URL Firebase Realtime Database (hoặc qua biến FIREBASE_DATABASE_URL)")
    p_add.add_argument("--out", default="../students_credentials.csv", help="Đường dẫn tệp CSV xuất mã PIN ngoài repo")
    p_add.add_argument("--dry-run", action="store_true", help="Chỉ kiểm tra và in bản ghi, không upload lên Firebase")

    # Subcommand: batch
    p_batch = subparsers.add_parser("batch", help="Thêm học sinh hàng loạt từ tệp JSON")
    p_batch.add_argument("file", help="Đường dẫn tệp JSON chứa danh sách học sinh")
    p_batch.add_argument("--service-account", help="Đường dẫn tệp service account JSON")
    p_batch.add_argument("--database-url", default=DEFAULT_DATABASE_URL, help="URL Firebase Realtime Database (hoặc qua biến FIREBASE_DATABASE_URL)")
    p_batch.add_argument("--out", default="../students_credentials.csv", help="Đường dẫn tệp CSV xuất mã PIN ngoài repo")
    p_batch.add_argument("--dry-run", action="store_true", help="Chỉ kiểm tra và in bảng phân công PIN, không upload")

    # Subcommand: list
    p_list = subparsers.add_parser("list", help="Liệt kê danh sách học sinh hiện có trên Firebase")
    p_list.add_argument("--service-account", required=True, help="Đường dẫn tệp service account JSON")
    p_list.add_argument("--database-url", default=DEFAULT_DATABASE_URL, help="URL Firebase Realtime Database (hoặc qua biến FIREBASE_DATABASE_URL)")

    args = parser.parse_args()

    if args.action == "add":
        rec = create_student_auth_record(args.id, args.name, args.grade, args.class_code, args.pin)
        print(f"[OK] Đã tạo bản ghi bảo mật cho học sinh:")
        print(f"  Mã học sinh : {rec['student_id']}")
        print(f"  Họ và tên   : {rec['name']}")
        print(f"  Khối / Lớp  : Khối {rec['grade']} / Lớp {rec['class_code']}")
        print(f"  Mã PIN      : {rec['raw_pin']}")
        print(f"  Salt ngẫu nhiên: {rec['salt']}")
        print(f"  PIN Hash    : {rec['pin_hash'][:16]}... (PBKDF2-HMAC-SHA256)")

        export_credentials_csv([rec], args.out)

        if args.dry_run:
            print("[DRY-RUN] Chế độ kiểm tra: Không gửi lên cơ sở dữ liệu.")
            return

        if not args.service_account:
            print("[ERROR] Bắt buộc cung cấp --service-account để upload lên Firebase (hoặc dùng --dry-run để thử nghiệm).")
            sys.exit(1)
        if not args.database_url:
            print("[ERROR] Bắt buộc cung cấp --database-url hoặc đặt biến môi trường FIREBASE_DATABASE_URL.")
            sys.exit(1)

        token = mint_oauth_token(args.service_account)
        ok = upload_student(args.database_url, token, rec)
        if ok:
            print(f"[SUCCESS] Đã lưu thông tin học sinh {rec['student_id']} thành công lên Firebase RTDB!")
        else:
            sys.exit(1)

    elif args.action == "batch":
        with open(args.file, 'r', encoding='utf-8') as f:
            students = json.load(f)
        
        if not isinstance(students, list):
            print("[ERROR] Tệp JSON phải chứa một danh sách (Array) các đối tượng học sinh.")
            sys.exit(1)

        records = []
        for i, item in enumerate(students):
            sid = item.get("id") or item.get("student_id")
            name = item.get("name") or item.get("student_name")
            grade = item.get("grade")
            class_code = item.get("class_code") or item.get("class")
            pin = item.get("pin")
            if not sid:
                print(f"[ERROR] Phần tử thứ {i+1} thiếu id.")
                sys.exit(1)
            rec = create_student_auth_record(sid, name, grade, class_code, pin)
            records.append(rec)

        print(f"=== BẢNG PHÂN BỔ TÀI KHOẢN VÀ MÃ PIN ({len(records)} HỌC SINH) ===")
        print(f"{'Mã HS':<12} | {'Họ và Tên':<25} | {'Khối':<5} | {'Lớp':<6} | {'Mã PIN'}")
        print("-" * 65)
        for rec in records:
            print(f"{rec['student_id']:<12} | {rec['name']:<25} | {rec['grade']:<5} | {rec['class_code']:<6} | {rec['raw_pin']}")
        print("-" * 65)

        export_credentials_csv(records, args.out)

        if args.dry_run:
            print("[DRY-RUN] Hoàn thành kiểm tra. Không tải lên Firebase.")
            return

        if not args.service_account:
            print("[ERROR] Bắt buộc cung cấp --service-account để tải lên Firebase (hoặc dùng --dry-run).")
            sys.exit(1)
        if not args.database_url:
            print("[ERROR] Bắt buộc cung cấp --database-url hoặc đặt biến môi trường FIREBASE_DATABASE_URL.")
            sys.exit(1)

        token = mint_oauth_token(args.service_account)
        success_count = 0
        for rec in records:
            if upload_student(args.database_url, token, rec):
                success_count += 1
        print(f"[SUCCESS] Đã tải lên thành công {success_count}/{len(records)} học sinh vào Firebase RTDB.")

    elif args.action == "list":
        if not args.database_url:
            print("[ERROR] Bắt buộc cung cấp --database-url hoặc đặt biến môi trường FIREBASE_DATABASE_URL.")
            sys.exit(1)
        token = mint_oauth_token(args.service_account)
        student_list = list_students(args.database_url, token)
        print(f"=== DANH SÁCH HỌC SINH TRÊN CƠ SỞ DỮ LIỆU ({len(student_list)} HỌC SINH) ===")
        print(f"{'Mã HS':<12} | {'Họ và Tên':<25} | {'Khối':<5} | {'Lớp':<6}")
        print("-" * 55)
        for s in student_list:
            print(f"{s['student_id']:<12} | {s['name']:<25} | {str(s['grade']):<5} | {s['class_code']:<6}")
        print("-" * 55)

if __name__ == "__main__":
    main()
