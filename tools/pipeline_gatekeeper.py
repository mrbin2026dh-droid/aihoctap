"""
Script Gác Cổng Hiến Pháp Antigravity (Antigravity Master Pipeline Gatekeeper)
Chạy script này để kiểm tra xem hệ thống có tuân thủ 100% 4 bước của Hiến pháp hay không.
Nếu vi phạm bất kỳ bước nào, script trả về EXIT CODE 1 (DỪNG DỰ ÁN NGAY LẬP TỨC).
"""
import sys
from pathlib import Path
import subprocess

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = Path(__file__).resolve().parent.parent

def check_gate(name: str, condition: bool, error_msg: str):
    if condition:
        print(f"  [PASS] {name}")
    else:
        print(f"  [FAIL] {name}: {error_msg}")
        return False
    return True

def run():
    print("=" * 60)
    print("KIỂM TRA TUÂN THỦ HIẾN PHÁP ANTIGRAVITY (4 BƯỚC BẮT BUỘC)")
    print("=" * 60)
    passed = True

    # 1. BƯỚC 1: CodeGraph Index
    codegraph_dir = BASE_DIR / ".codegraph"
    if not check_gate("Bước 1.1: CodeGraph Index", codegraph_dir.exists(), "Chưa khởi tạo .codegraph index!"):
        passed = False

    # 2. BƯỚC 1: Dữ liệu SGK Chuẩn
    tin6_md = BASE_DIR / "data" / "curriculum" / "tin6" / "bai1_thong_tin_va_du_lieu.md"
    tin6_json = BASE_DIR / "data" / "curriculum" / "tin6" / "bai1_quiz.json"
    if not check_gate("Bước 1.2: Dữ liệu SGK Markdown & Quiz JSON", tin6_md.exists() and tin6_json.exists(), "Thiếu file bài học Markdown hoặc JSON!"):
        passed = False

    # 3. BƯỚC 2: Ràng buộc Luật & TDD (Tests phải tồn tại)
    test_dir = BASE_DIR / "tests"
    has_tests = test_dir.exists() and any(test_dir.glob("test_*.py"))
    if not check_gate("Bước 3: TDD Tests & Contracts", has_tests, "Chưa có thư mục tests/ hoặc chưa có file test_*.py theo luật TDD!"):
        passed = False

    # 4. BƯỚC 4: Git Pre-Commit Hook
    hook_file = BASE_DIR / ".git" / "hooks" / "pre-commit"
    if not check_gate("Bước 4: Git Pre-Commit Gatekeeper", hook_file.exists(), "Chưa cài đặt Git pre-commit hook!"):
        passed = False

    print("=" * 60)
    if not passed:
        print("KET QUA: VI PHAM HIEN PHAP! Khoa toan bo tien trinh. (Exit Code 1)")
        sys.exit(1)
    else:
        print("KET QUA: HOP CHUAN 100%! Du dieu kien thuc thi tiep. (Exit Code 0)")
        sys.exit(0)

if __name__ == "__main__":
    run()
