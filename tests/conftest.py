"""
Cấu hình kiểm thử toàn cục (Global Test Fixtures)
Đảm bảo 100% môi trường kiểm thử được cô lập hoàn toàn trong thư mục tạm:
- EXAMS_DIR, SUBMISSIONS_DIR, CURRICULUM_DIR, CURRICULUM_V2_DIR
- STUDENTS_REGISTRY_FILE
- Mock network sync Firebase RTDB (0% mạng ngoài)
- Không ghi/xóa bất kỳ tệp dữ liệu thật nào của nhà trường
"""
import pytest
import json
import os
import shutil
from pathlib import Path

import backend.server as server_mod
import backend.exam_service as exam_service_mod
import backend.grounding as grounding_mod

@pytest.fixture(autouse=True)
def global_test_isolation(tmp_path, monkeypatch):
    """Cô lập toàn bộ hệ thống file, registry, session và network cho mọi test suite."""
    isolation_root = tmp_path / "global-test-data"
    exams_dir = isolation_root / "exams"
    subs_dir = exams_dir / "submissions"
    curriculum_dir = isolation_root / "curriculum"
    curriculum_v2_dir = isolation_root / "curriculum_v2_simple"
    registry_file = isolation_root / "students_registry.json"

    for d in (exams_dir, subs_dir, curriculum_dir, curriculum_v2_dir):
        d.mkdir(parents=True, exist_ok=True)

    # Nạp bản sao dữ liệu bài học mẫu vào tmp_path cô lập (Item 7)
    real_curriculum = Path(__file__).resolve().parent.parent / "data" / "curriculum"
    real_curriculum_v2 = Path(__file__).resolve().parent.parent / "frontend" / "data" / "curriculum_v2_simple"

    if real_curriculum.exists():
        for grade_dir in real_curriculum.iterdir():
            if grade_dir.is_dir():
                target_gdir = curriculum_dir / grade_dir.name
                target_gdir.mkdir(parents=True, exist_ok=True)
                for f in grade_dir.iterdir():
                    if f.is_file() and not f.name.endswith(".bak"):
                        shutil.copy2(f, target_gdir / f.name)

    if real_curriculum_v2.exists():
        for grade_dir in real_curriculum_v2.iterdir():
            if grade_dir.is_dir():
                target_gdir = curriculum_v2_dir / grade_dir.name
                target_gdir.mkdir(parents=True, exist_ok=True)
                for f in grade_dir.iterdir():
                    if f.is_file():
                        shutil.copy2(f, target_gdir / f.name)

    # Khởi tạo mock students_registry trong thư mục tạm
    registry_data = {
        "123456": {
            "uid": "std_123456",
            "student_name": "Nguyễn Minh Khang",
            "class_code": "9A",
            "grade": 9,
            "is_blocked": False
        },
        "112233": {
            "uid": "std_112233",
            "student_name": "Trần Thị Mai",
            "class_code": "9A",
            "grade": 9,
            "is_blocked": False
        }
    }
    registry_file.write_text(json.dumps(registry_data, ensure_ascii=False, indent=2), encoding="utf-8")

    # Monkeypatch toàn bộ các đường dẫn dữ liệu
    monkeypatch.setattr(exam_service_mod, "EXAMS_DIR", exams_dir)
    monkeypatch.setattr(exam_service_mod, "SUBMISSIONS_DIR", subs_dir)
    monkeypatch.setattr(server_mod, "EXAMS_DIR", exams_dir)
    monkeypatch.setattr(server_mod, "SUBMISSIONS_DIR", subs_dir)
    if hasattr(server_mod, "CURRICULUM_DIR"):
        monkeypatch.setattr(server_mod, "CURRICULUM_DIR", curriculum_dir)
    if hasattr(server_mod, "CURRICULUM_V2_DIR"):
        monkeypatch.setattr(server_mod, "CURRICULUM_V2_DIR", curriculum_v2_dir)
    monkeypatch.setattr(grounding_mod, "CURRICULUM_DIR", curriculum_dir)
    monkeypatch.setattr(grounding_mod, "CURRICULUM_V2_DIR", curriculum_v2_dir)
    monkeypatch.setattr(server_mod, "STUDENTS_REGISTRY_FILE", registry_file)

    # Monkeypatch network sync để không gọi mạng ngoài
    monkeypatch.setattr(exam_service_mod, "sync_to_firebase_rtdb", lambda *args, **kwargs: True)

    # Vô hiệu hóa strict cloud sync trong các bài test mặc định
    monkeypatch.setenv("AISGK_STRICT_CLOUD_SYNC", "0")

    yield
