"""PWA contracts against the real router/storage, isolated from school data."""
import hashlib
import json
import time
import uuid

import pytest
from fastapi.testclient import TestClient

from backend import server


@pytest.fixture
def pwa_client(monkeypatch, tmp_path):
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.delenv("PWA_FIREBASE_DATABASE_URL", raising=False)
    monkeypatch.setenv("PWA_DATABASE_PATH", str(tmp_path / "pwa.sqlite"))
    server.ACTIVE_TEACHER_SESSIONS["pwa-teacher"] = time.time() + 600
    for code, grade in (("123456", 9), ("112233", 9), ("600001", 6)):
        server.ACTIVE_STUDENT_SESSIONS[f"pwa-{code}"] = {
            "uid": f"std_{code}", "student_code": code, "grade": grade,
            "class_code": f"{grade}A", "student_name": "Test student",
            "exp": time.time() + 600,
        }
    return TestClient(server.app)


TEACHER = {"Authorization": "Bearer pwa-teacher"}
STUDENT = {"Authorization": "Bearer pwa-123456"}
OTHER = {"Authorization": "Bearer pwa-112233"}


def lesson_document(title="Phân số"):
    return {
        "subject_id": "toan", "subject_name": "Toán", "grade": 9,
        "lesson_id": "phan-so", "title": title,
        "content_markdown": "# Phân số\n\n## Ôn tập\nHãy đọc nội dung và giải thích cách làm.",
        "questions": [
            {"id": "q1", "prompt": "Một phần hai bằng phân số nào?", "kind": "choice",
             "options": {"A": "Hai phần bốn", "B": "Ba phần bốn"}, "correct_answer": "A", "hint": "Nhân cả tử và mẫu cùng một số."},
            {"id": "q2", "prompt": "Giải thích vì sao hai phân số bằng nhau.", "kind": "text",
             "options": {}, "correct_answer": "", "hint": "Nêu quy tắc đã học."},
        ],
    }


def publish(client, document=None):
    response = client.post("/api/pwa/teacher/publish", headers=TEACHER, json=document or lesson_document())
    assert response.status_code == 200, response.text
    return response.json()


def package_for(client, catalog):
    course = next(item for item in catalog["courses"] if item["id"] == "toan-9")
    lesson = course["lessons"][0]
    response = client.get(f"/api/pwa/lessons/toan-9/phan-so/{lesson['version']}")
    assert response.status_code == 200, response.text
    return response.json()


def attempt_for(package, **kwargs):
    return {"attempt_id": str(uuid.uuid4()), "course_id": package["course_id"],
            "lesson_id": package["lesson_id"], "version": package["version"],
            "answers": {"q1": "A", "q2": "Nhân cả tử và mẫu với hai."}, **kwargs}


def test_pwa_catalog_route_exists_and_has_schema(pwa_client):
    response = pwa_client.get("/api/pwa/catalog")
    assert response.status_code == 200
    assert response.json()["schema_version"] == 1
    assert isinstance(response.json()["courses"], list)


def test_pwa_publish_and_public_package_canonical_hash(pwa_client):
    catalog = publish(pwa_client)
    package = package_for(pwa_client, catalog)
    version = package.pop("version")
    canonical = json.dumps(package, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    assert hashlib.sha256(canonical.encode()).hexdigest() == version
    serialized = json.dumps(package)
    assert "correct_answer" not in serialized
    assert "dap_an_dung" not in serialized
    assert package["questions"][1]["kind"] == "text"
    assert catalog["revision"]


def test_pwa_teacher_auth_is_required_for_private_content_and_publish(pwa_client):
    assert pwa_client.post("/api/pwa/teacher/publish", json=lesson_document()).status_code == 401
    publish(pwa_client)
    assert pwa_client.get("/api/pwa/teacher/lesson/toan-9/phan-so").status_code == 401
    assert pwa_client.get("/api/pwa/teacher/results", headers=STUDENT).status_code == 401
    private = pwa_client.get("/api/pwa/teacher/lesson/toan-9/phan-so", headers=TEACHER)
    assert private.status_code == 200
    assert private.json()["questions"][0]["correct_answer"] == "A"


def test_pwa_previous_version_survives_edit_and_grades_original(pwa_client):
    original = package_for(pwa_client, publish(pwa_client))
    changed = lesson_document("Phân số cập nhật")
    changed["questions"][0]["correct_answer"] = "B"
    updated = package_for(pwa_client, publish(pwa_client, changed))
    assert updated["version"] != original["version"]
    old_response = pwa_client.get(f"/api/pwa/lessons/toan-9/phan-so/{original['version']}")
    assert old_response.json() == original
    response = pwa_client.post("/api/pwa/attempts", headers=STUDENT, json=attempt_for(original))
    assert response.status_code == 200, response.text
    assert response.json()["correct"] == 1
    assert response.json()["needs_review"] is True
    assert response.json()["feedback"][1]["correct"] is None


def test_pwa_attempt_auth_identity_and_idempotency(pwa_client):
    package = package_for(pwa_client, publish(pwa_client))
    payload = attempt_for(package)
    assert pwa_client.post("/api/pwa/attempts", json=payload).status_code == 401
    first = pwa_client.post("/api/pwa/attempts", headers=STUDENT, json=payload)
    assert first.status_code == 200, first.text
    second = pwa_client.post("/api/pwa/attempts", headers=STUDENT, json=payload)
    assert second.json() == first.json()
    payload["answers"]["q1"] = "B"
    assert pwa_client.post("/api/pwa/attempts", headers=STUDENT, json=payload).status_code == 409
    mine = pwa_client.get("/api/pwa/progress", headers=STUDENT).json()["attempts"]
    assert len(mine) == 1
    assert pwa_client.get("/api/pwa/progress", headers=OTHER).json()["attempts"] == []
    assert pwa_client.get("/api/pwa/me", headers=STUDENT).json()["uid"] == "std_123456"
    results = pwa_client.get("/api/pwa/teacher/results", headers=TEACHER).json()["attempts"]
    assert results[0]["uid"] == "std_123456"
    assert results[0]["answers"]["q2"] == "Nhân cả tử và mẫu với hai."


def test_pwa_rejects_wrong_grade_and_spoofed_fields(pwa_client):
    package = package_for(pwa_client, publish(pwa_client))
    payload = attempt_for(package)
    assert pwa_client.post("/api/pwa/attempts", headers={"Authorization": "Bearer pwa-600001"}, json=payload).status_code == 403
    payload["uid"] = "other"
    assert pwa_client.post("/api/pwa/attempts", headers=STUDENT, json=payload).status_code == 422


@pytest.mark.parametrize("mutation", ["invalid_answer", "duplicate_id", "path", "empty_title", "unknown_field"])
def test_pwa_invalid_publish_keeps_catalog_unchanged(pwa_client, mutation):
    baseline = publish(pwa_client)
    invalid = lesson_document()
    if mutation == "invalid_answer":
        invalid["questions"][0]["correct_answer"] = "Z"
    elif mutation == "duplicate_id":
        invalid["questions"][1]["id"] = "q1"
    elif mutation == "path":
        invalid["subject_id"] = "../../escape"
    elif mutation == "empty_title":
        invalid["title"] = " "
    else:
        invalid["is_admin"] = True
    response = pwa_client.post("/api/pwa/teacher/publish", headers=TEACHER, json=invalid)
    assert response.status_code == 422, response.text
    assert pwa_client.get("/api/pwa/catalog").json() == baseline


def test_pwa_rejects_invalid_and_missing_question_answers(pwa_client):
    package = package_for(pwa_client, publish(pwa_client))
    for answers in ({"q1": "Z", "q2": "test"}, {"q1": "A"}, {"q1": "A", "q2": "test", "forged": "A"}):
        response = pwa_client.post("/api/pwa/attempts", headers=STUDENT, json=attempt_for(package, answers=answers))
        assert response.status_code == 422, response.text
    assert pwa_client.get("/api/pwa/progress", headers=STUDENT).json()["attempts"] == []


def test_pwa_ephemeral_render_refuses_false_persistence(pwa_client, monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.delenv("PWA_DATABASE_PATH", raising=False)
    monkeypatch.delenv("PWA_DURABLE_DIRECTORY", raising=False)
    assert pwa_client.get("/api/pwa/catalog").status_code == 200
    response = pwa_client.post("/api/pwa/teacher/publish", headers=TEACHER, json=lesson_document())
    assert response.status_code == 503
    assert "lưu" in response.json()["detail"].lower()


def test_pwa_published_document_survives_new_store_instance(pwa_client):
    catalog = publish(pwa_client)
    assert TestClient(server.app).get("/api/pwa/catalog").json() == catalog


def test_pwa_catalog_etag_revalidation(pwa_client):
    publish(pwa_client)
    first = pwa_client.get("/api/pwa/catalog")
    assert first.headers.get("etag")
    response = pwa_client.get("/api/pwa/catalog", headers={"If-None-Match": first.headers["etag"]})
    assert response.status_code == 304


def test_pwa_answer_only_edit_has_immutable_grading(pwa_client):
    original = package_for(pwa_client, publish(pwa_client))
    changed = lesson_document()
    changed['questions'][0]['correct_answer'] = 'B'
    updated = package_for(pwa_client, publish(pwa_client, changed))
    assert updated['version'] != original['version']
    for package, correct in ((original, 1), (updated, 0)):
        response = pwa_client.post('/api/pwa/attempts', headers=STUDENT, json=attempt_for(package))
        assert response.status_code == 200
        assert response.json()['correct'] == correct


def test_pwa_maximum_subject_id_remains_submittable(pwa_client):
    document = lesson_document()
    document['subject_id'] = 'a' * 64
    catalog = publish(pwa_client, document)
    course = next(c for c in catalog['courses'] if c['subject_id'] == document['subject_id'])
    summary = course['lessons'][0]
    package = pwa_client.get(f"/api/pwa/lessons/{course['id']}/phan-so/{summary['version']}").json()
    response = pwa_client.post('/api/pwa/attempts', headers=STUDENT, json=attempt_for(package))
    assert response.status_code == 200, response.text


def test_pwa_concurrent_retry_has_one_record(pwa_client):
    from concurrent.futures import ThreadPoolExecutor
    package = package_for(pwa_client, publish(pwa_client))
    payload = attempt_for(package)
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(lambda _: pwa_client.post('/api/pwa/attempts', headers=STUDENT, json=payload), range(4)))
    assert all(response.status_code == 200 for response in responses)
    assert all(response.json() == responses[0].json() for response in responses)
    assert len(pwa_client.get('/api/pwa/progress', headers=STUDENT).json()['attempts']) == 1


def test_pwa_render_arbitrary_path_does_not_prove_durability(pwa_client, monkeypatch):
    monkeypatch.setenv('RENDER', 'true')
    monkeypatch.delenv('PWA_DURABLE_DIRECTORY', raising=False)
    response = pwa_client.post('/api/pwa/teacher/publish', headers=TEACHER, json=lesson_document())
    assert response.status_code == 503


def test_pwa_seeds_published_curriculum_without_public_keys(pwa_client):
    catalog = pwa_client.get('/api/pwa/catalog').json()
    course = next(c for c in catalog['courses'] if c['id'] == 'tin-hoc-9')
    assert course['lessons']
    summary = course['lessons'][0]
    response = pwa_client.get(f"/api/pwa/lessons/tin-hoc-9/{summary['id']}/{summary['version']}")
    assert response.status_code == 200
    assert response.json()['content_markdown'].strip()
    assert 'dap_an_dung' not in response.text
    assert 'correct_answer' not in response.text


def test_pwa_subject_rename_updates_course_metadata(pwa_client):
    original = lesson_document()
    publish(pwa_client, original)
    second = lesson_document('Bài thứ hai')
    second['lesson_id'] = 'bai-hai'
    second['subject_name'] = 'Toán học đổi tên'
    catalog = publish(pwa_client, second)
    course = next(c for c in catalog['courses'] if c['id'] == 'toan-9')
    assert course['subject_name'] == second['subject_name']
