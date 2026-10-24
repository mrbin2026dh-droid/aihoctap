"""Independent PWA storage/auth regressions; only synthetic isolated fixtures."""
from concurrent.futures import ThreadPoolExecutor
import copy
import json
import sqlite3
import time

import pytest

from backend import pwa_service, server
from tests.test_pwa_api import (
    OTHER, STUDENT, TEACHER, attempt_for, lesson_document, package_for,
    publish, pwa_client,
)


def test_identical_publication_is_stable_under_concurrent_retries(pwa_client, monkeypatch):
    original = publish(pwa_client)
    with ThreadPoolExecutor(max_workers=4) as executor:
        responses = list(executor.map(
            lambda _: pwa_client.post('/api/pwa/teacher/publish', headers=TEACHER,
                                      json=lesson_document()), range(4)))
    assert all(response.status_code == 200 for response in responses)
    assert all(response.json() == original for response in responses)
    assert pwa_client.get('/api/pwa/catalog').json() == original


def test_concurrent_distinct_lessons_are_not_lost(pwa_client):
    def publish_one(index):
        document = lesson_document(f'Lesson {index}')
        document['lesson_id'] = f'lesson-{index}'
        return pwa_client.post('/api/pwa/teacher/publish', headers=TEACHER, json=document)

    with ThreadPoolExecutor(max_workers=4) as executor:
        responses = list(executor.map(publish_one, range(4)))
    assert all(response.status_code == 200 for response in responses)
    catalog = pwa_client.get('/api/pwa/catalog').json()
    course = next(course for course in catalog['courses'] if course['id'] == 'toan-9')
    assert {lesson['id'] for lesson in course['lessons']} == {f'lesson-{i}' for i in range(4)}
    for summary in course['lessons']:
        response = pwa_client.get(f"/api/pwa/lessons/toan-9/{summary['id']}/{summary['version']}")
        assert response.status_code == 200


def test_publish_failure_rolls_back_package_and_catalog(pwa_client, monkeypatch):
    original = publish(pwa_client)
    from backend.pwa_store import database
    with database() as connection:
        original_package_count = connection.execute('SELECT count(*) FROM packages').fetchone()[0]
    original_catalog_from = pwa_service.catalog_from

    def storage_failure(_connection):
        raise sqlite3.OperationalError('synthetic failure before commit')

    monkeypatch.setattr(pwa_service, 'catalog_from', storage_failure)
    document = lesson_document('Must not be published')
    response = pwa_client.post('/api/pwa/teacher/publish', headers=TEACHER, json=document)
    assert response.status_code == 503
    assert 'synthetic' not in response.text
    monkeypatch.setattr(pwa_service, 'catalog_from', original_catalog_from)
    assert pwa_client.get('/api/pwa/catalog').json() == original
    with database() as connection:
        assert connection.execute('SELECT count(*) FROM packages').fetchone()[0] == original_package_count


@pytest.mark.parametrize('outside', [True, False])
def test_render_storage_requires_resolved_containment(pwa_client, monkeypatch, tmp_path, outside):
    durable = tmp_path / 'durable'
    durable.mkdir()
    monkeypatch.setenv('RENDER', 'true')
    monkeypatch.setenv('PWA_DURABLE_DIRECTORY', str(durable))
    destination = (durable / '..' / 'outside.sqlite') if outside else durable / 'inside.sqlite'
    monkeypatch.setenv('PWA_DATABASE_PATH', str(destination))
    response = pwa_client.post('/api/pwa/teacher/publish', headers=TEACHER, json=lesson_document())
    assert response.status_code == (503 if outside else 200)
    assert destination.exists() is (not outside)


def test_render_nonexistent_durable_directory_fails_without_creating_it(pwa_client, monkeypatch, tmp_path):
    durable = tmp_path / 'not-a-mounted-directory'
    monkeypatch.setenv('RENDER', 'true')
    monkeypatch.setenv('PWA_DURABLE_DIRECTORY', str(durable))
    monkeypatch.delenv('PWA_DATABASE_PATH')
    response = pwa_client.post('/api/pwa/teacher/publish', headers=TEACHER, json=lesson_document())
    assert response.status_code == 503
    assert not durable.exists()


@pytest.mark.parametrize('path,headers', [
    ('/api/pwa/me', STUDENT),
    ('/api/pwa/progress', STUDENT),
    ('/api/pwa/teacher/results', TEACHER),
    ('/api/pwa/teacher/lesson/toan-9/phan-so', TEACHER),
    ('/api/pwa/teacher/results', {}),
    ('/api/pwa/me', {}),
])
def test_private_and_denied_responses_cannot_be_cached(pwa_client, path, headers):
    publish(pwa_client)
    response = pwa_client.get(path, headers=headers)
    assert response.status_code == (200 if headers else 401)
    assert 'no-store' in response.headers.get('cache-control', '')


def test_submission_ack_cannot_be_cached(pwa_client):
    package = package_for(pwa_client, publish(pwa_client))
    response = pwa_client.post('/api/pwa/attempts', headers=STUDENT, json=attempt_for(package))
    assert response.status_code == 200
    assert 'no-store' in response.headers.get('cache-control', '')


def test_student_cannot_publish_or_read_private_answer_keys(pwa_client):
    publish(pwa_client)
    assert pwa_client.post('/api/pwa/teacher/publish', headers=STUDENT,
                           json=lesson_document('Unauthorized')).status_code == 401
    assert pwa_client.get('/api/pwa/teacher/lesson/toan-9/phan-so', headers=STUDENT).status_code == 401
    assert pwa_client.get('/api/pwa/progress', headers=TEACHER).status_code == 401


def test_expired_teacher_session_cannot_modify_catalog(pwa_client):
    original = publish(pwa_client)
    server.ACTIVE_TEACHER_SESSIONS['pwa-teacher'] = time.time() - 1
    response = pwa_client.post('/api/pwa/teacher/publish', headers=TEACHER,
                               json=lesson_document('Expired teacher'))
    assert response.status_code == 401
    assert pwa_client.get('/api/pwa/catalog').json() == original


def test_expired_student_session_cannot_submit(pwa_client):
    package = package_for(pwa_client, publish(pwa_client))
    server.ACTIVE_STUDENT_SESSIONS['pwa-123456']['exp'] = time.time() - 1
    response = pwa_client.post('/api/pwa/attempts', headers=STUDENT, json=attempt_for(package))
    assert response.status_code == 401
    assert pwa_client.get('/api/pwa/teacher/results', headers=TEACHER).json()['attempts'] == []


def test_same_attempt_uuid_is_isolated_between_accounts(pwa_client):
    package = package_for(pwa_client, publish(pwa_client))
    payload = attempt_for(package)
    first = pwa_client.post('/api/pwa/attempts', headers=STUDENT, json=payload)
    other_payload = copy.deepcopy(payload)
    other_payload['answers']['q1'] = 'B'
    second = pwa_client.post('/api/pwa/attempts', headers=OTHER, json=other_payload)
    assert first.status_code == second.status_code == 200
    assert first.json()['correct'] == 1
    assert second.json()['correct'] == 0
    assert len(pwa_client.get('/api/pwa/progress', headers=STUDENT).json()['attempts']) == 1
    assert len(pwa_client.get('/api/pwa/progress', headers=OTHER).json()['attempts']) == 1
    assert len(pwa_client.get('/api/pwa/teacher/results', headers=TEACHER).json()['attempts']) == 2


def test_missing_version_and_sql_metacharacters_never_return_private_content(pwa_client):
    package = package_for(pwa_client, publish(pwa_client))
    for version in ('f' * 64, "x'OR'1'='1"):
        response = pwa_client.get(f'/api/pwa/lessons/toan-9/phan-so/{version}')
        assert response.status_code == 404
        assert 'correct_answer' not in response.text
    payload = attempt_for(package)
    payload['version'] = 'f' * 64
    response = pwa_client.post('/api/pwa/attempts', headers=STUDENT, json=payload)
    assert response.status_code == 404
    assert pwa_client.get('/api/pwa/progress', headers=STUDENT).json()['attempts'] == []


@pytest.mark.parametrize('answers', [{'q1': 'A', 'q2': ''}, {'q1': 'A', 'q2': '   '}])
def test_blank_text_answer_does_not_create_attempt(pwa_client, answers):
    package = package_for(pwa_client, publish(pwa_client))
    response = pwa_client.post('/api/pwa/attempts', headers=STUDENT,
                               json=attempt_for(package, answers=answers))
    assert response.status_code == 422
    assert pwa_client.get('/api/pwa/progress', headers=STUDENT).json()['attempts'] == []


def synthetic_seed_source(tmp_path, monkeypatch):
    from backend import grounding
    directory = tmp_path / 'synthetic-source' / 'tin9'
    directory.mkdir(parents=True)
    for index in (1, 2):
        data = {'status': 'published', 'grade': 9, 'lesson_id': index,
                'title': f'Synthetic seed lesson {index}',
                'content_markdown': f'Synthetic original content {index}.', 'quiz': []}
        (directory / f'bai{index}.json').write_text(json.dumps(data), encoding='utf-8')
    monkeypatch.setattr(grounding, 'CURRICULUM_V2_DIR', directory.parent)


def test_interrupted_seed_retries_missing_lessons_and_preserves_teacher_edits(pwa_client, tmp_path, monkeypatch):
    from fastapi import HTTPException
    from backend.pwa_store import database
    synthetic_seed_source(tmp_path, monkeypatch)
    original_publish = pwa_service.publish
    seed_calls = 0

    def interrupted_publish(document, *, only_if_missing=False):
        nonlocal seed_calls
        if only_if_missing:
            seed_calls += 1
            if seed_calls == 2:
                raise HTTPException(503, 'Synthetic storage interruption')
        return original_publish(document, only_if_missing=only_if_missing)

    monkeypatch.setattr(pwa_service, 'publish', interrupted_publish)
    response = pwa_client.get('/api/pwa/catalog')
    assert response.status_code == 503
    with database() as connection:
        assert connection.execute('SELECT count(*) FROM lessons').fetchone()[0] == 1
    monkeypatch.setattr(pwa_service, 'publish', original_publish)
    customized = lesson_document('Teacher custom title must survive retry')
    customized['subject_id'] = 'tin-hoc'
    customized['subject_name'] = 'Tin học'
    customized['lesson_id'] = 'bai-1'
    customized['content_markdown'] = 'Synthetic teacher content overrides seed.'
    publish(pwa_client, customized)
    retry = pwa_client.get('/api/pwa/catalog')
    assert retry.status_code == 200
    course = next(course for course in retry.json()['courses'] if course['id'] == 'tin-hoc-9')
    assert {lesson['id'] for lesson in course['lessons']} == {'bai-1', 'bai-2'}
    private = pwa_client.get('/api/pwa/teacher/lesson/tin-hoc-9/bai-1', headers=TEACHER)
    assert private.status_code == 200
    assert private.json() == customized
    assert pwa_client.get('/api/pwa/catalog').json() == retry.json()


def test_teacher_first_publication_still_initializes_all_seed_content(pwa_client, tmp_path, monkeypatch):
    synthetic_seed_source(tmp_path, monkeypatch)
    publish(pwa_client)
    catalog = pwa_client.get('/api/pwa/catalog').json()
    course = next((course for course in catalog['courses'] if course['id'] == 'tin-hoc-9'), None)
    assert course is not None, 'A teacher publication must not suppress seed initialization.'
    assert {lesson['id'] for lesson in course['lessons']} == {'bai-1', 'bai-2'}
    teacher_lesson = pwa_client.get('/api/pwa/teacher/lesson/toan-9/phan-so', headers=TEACHER)
    assert teacher_lesson.status_code == 200
    assert teacher_lesson.json()['title'] == 'Phân số'
