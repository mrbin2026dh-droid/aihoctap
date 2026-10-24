"""Public entry must be independently installable without loading the tutor."""
from fastapi.testclient import TestClient
from backend.server import app


def test_student_entry_and_manifest_are_available():
    client = TestClient(app)
    response = client.get('/hoc/')
    assert response.status_code == 200
    manifest = client.get('/hoc/manifest.webmanifest')
    assert manifest.status_code == 200
    assert manifest.json()['scope'] == './'
    assert manifest.json()['display'] == 'standalone'


def test_teacher_entry_is_separate_from_student_shell():
    client = TestClient(app)
    assert client.get('/hoc/teacher.html').status_code == 200
