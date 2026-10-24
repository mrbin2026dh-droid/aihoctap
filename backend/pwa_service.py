"""Versioned public content and private deterministic grading, without an LLM."""
import hashlib
import json
import uuid

from fastapi import HTTPException

from backend.pwa_contracts import AttemptSubmission, PublishLesson, TutorRequest
from backend.pwa_store import canonical, database


def digest(value: object) -> str:
    return hashlib.sha256(canonical(value).encode('utf-8')).hexdigest()


def catalog_from(connection) -> dict:
    courses = {}
    if connection is not None:
        rows = connection.execute('''SELECT l.course_id,l.lesson_id,l.version,l.course,p.public
            FROM lessons l JOIN packages p USING(course_id,lesson_id,version)
            ORDER BY l.course_id,l.lesson_id''').fetchall()
        for row in rows:
            course = courses.setdefault(row['course_id'], {**json.loads(row['course']), 'lessons': []})
            package = json.loads(row['public'])
            course['lessons'].append({'id': row['lesson_id'], 'title': package['title'],
                                      'version': row['version'], 'question_count': len(package['questions'])})
    values = list(courses.values())
    return {'schema_version': 1, 'revision': digest(values), 'courses': values}


def catalog() -> dict:
    from backend.pwa_seed import seed_if_empty
    seed_if_empty()
    with database() as connection:
        return catalog_from(connection)


def publish(document: PublishLesson, *, only_if_missing: bool = False) -> dict:
    if not only_if_missing:
        from backend.pwa_seed import seed_if_empty
        seed_if_empty()
    private = document.model_dump()
    course_id = f'{document.subject_id}-{document.grade}'
    with database(write=True) as connection:
        prior = connection.execute('''SELECT p.private FROM lessons l JOIN packages p
            USING(course_id,lesson_id,version) WHERE l.course_id=? AND l.lesson_id=?''',
                                   (course_id, document.lesson_id)).fetchone()
        if prior and (only_if_missing or json.loads(prior['private']) == private):
            return catalog_from(connection)
        public = {'schema_version': 1, 'course_id': course_id, 'lesson_id': document.lesson_id,
                  'title': document.title, 'content_markdown': document.content_markdown,
                  'grading_revision': uuid.uuid4().hex,
                  'questions': [question.model_dump(exclude={'correct_answer'}) for question in document.questions]}
        public['version'] = digest(public)
        course = {'id': course_id, 'subject_id': document.subject_id,
                  'subject_name': document.subject_name, 'grade': document.grade,
                  'title': f'{document.subject_name} {document.grade}'}
        connection.execute('INSERT INTO packages VALUES (?,?,?,?,?)',
                           (course_id, document.lesson_id, public['version'], canonical(public), canonical(private)))
        connection.execute('UPDATE lessons SET course=? WHERE course_id=?', (canonical(course), course_id))
        connection.execute('''INSERT INTO lessons VALUES (?,?,?,?) ON CONFLICT(course_id,lesson_id)
            DO UPDATE SET version=excluded.version,course=excluded.course''',
                           (course_id, document.lesson_id, public['version'], canonical(course)))
        return catalog_from(connection)


def lesson(course_id: str, lesson_id: str, version: str | None = None, *, private: bool = False) -> dict:
    with database() as connection:
        row = None
        if connection is not None:
            if version is None:
                row = connection.execute('''SELECT p.* FROM lessons l JOIN packages p
                    USING(course_id,lesson_id,version) WHERE l.course_id=? AND l.lesson_id=?''',
                                         (course_id, lesson_id)).fetchone()
            else:
                row = connection.execute('SELECT * FROM packages WHERE course_id=? AND lesson_id=? AND version=?',
                                         (course_id, lesson_id, version)).fetchone()
        if row is None:
            raise HTTPException(404, 'Chưa tìm thấy phiên bản bài học.')
        return json.loads(row['private' if private else 'public'])


def submit(body: AttemptSubmission, identity: dict) -> dict:
    uid = identity['uid']
    serialized = canonical(body.model_dump(mode='json'))
    with database(write=True) as connection:
        existing = connection.execute('SELECT body,ack FROM attempts WHERE uid=? AND attempt_id=?',
                                      (uid, str(body.attempt_id))).fetchone()
        if existing:
            if existing['body'] != serialized:
                raise HTTPException(409, 'Mã bài nộp này đã dùng với nội dung khác.')
            return json.loads(existing['ack'])
        row = connection.execute('SELECT private FROM packages WHERE course_id=? AND lesson_id=? AND version=?',
                                 (body.course_id, body.lesson_id, body.version)).fetchone()
        if row is None:
            raise HTTPException(404, 'Chưa tìm thấy phiên bản bài học.')
        document = json.loads(row['private'])
        if document['grade'] != identity.get('grade'):
            raise HTTPException(403, 'Bài học không thuộc khối lớp của em.')
        questions = document['questions']
        if set(body.answers) != {question['id'] for question in questions}:
            raise HTTPException(422, 'Cần trả lời đầy đủ đúng các câu hỏi của bài.')
        feedback = []
        for question in questions:
            answer = body.answers[question['id']]
            if question['kind'] == 'choice' and answer not in question['options']:
                raise HTTPException(422, 'Lựa chọn chưa hợp lệ.')
            if not answer.strip():
                raise HTTPException(422, 'Câu trả lời chưa có nội dung.')
            correct = answer == question['correct_answer'] if question['kind'] == 'choice' else None
            feedback.append({'id': question['id'], 'correct': correct, 'hint': question['hint']})
        correct_count = sum(item['correct'] is True for item in feedback)
        graded_count = sum(item['correct'] is not None for item in feedback)
        ack = {**body.model_dump(mode='json', exclude={'answers'}), 'status': 'submitted',
               'correct': correct_count, 'total': len(questions),
               'score': round(10 * correct_count / graded_count, 2) if graded_count else None,
               'needs_review': any(item['correct'] is None for item in feedback), 'feedback': feedback}
        record = {**ack, 'uid': uid, 'student_name': identity.get('student_name', ''),
                  'class_code': identity.get('class_code', ''), 'answers': body.answers}
        connection.execute('INSERT INTO attempts VALUES (?,?,?,?,?)',
                           (uid, str(body.attempt_id), serialized, canonical(ack), canonical(record)))
        return ack


def results(uid: str | None = None) -> dict:
    with database() as connection:
        if connection is None:
            return {'attempts': []}
        if uid is None:
            rows = connection.execute('SELECT record FROM attempts ORDER BY rowid DESC').fetchall()
            return {'attempts': [json.loads(row['record']) for row in rows]}
        rows = connection.execute('SELECT ack FROM attempts WHERE uid=? ORDER BY rowid DESC', (uid,)).fetchall()
        return {'attempts': [json.loads(row['ack']) for row in rows]}


def tutor(body: TutorRequest) -> dict:
    import re
    from backend.agent import chat_with_tutor
    from backend.contracts import ChatContext

    document = lesson(body.course_id, body.lesson_id, private=True)
    grade = int(document.get('grade', 6))

    match = re.search(r'\d+', body.lesson_id)
    lesson_num = int(match.group()) if match else 1

    quiz_data = [
        {
            'id': q['id'],
            'cau_hoi': q['prompt'],
            'lua_chon': q.get('options', {}),
            'dap_an_dung': q.get('correct_answer', ''),
            'goi_y_khi_sai': q.get('hint', ''),
        }
        for q in document.get('questions', [])
    ]

    context = None
    if body.question_id:
        context = ChatContext(
            current_question_id=body.question_id,
            student_choice=body.selected_option if body.selected_option in ('A', 'B', 'C', 'D') else None,
            attempt_count=body.attempt_count,
            active_tab='quiz',
        )

    reply = chat_with_tutor(
        grade=grade,
        lesson_id=lesson_num,
        message=body.message,
        history=body.history,
        curriculum_text=document.get('content_markdown', ''),
        context=context,
        quiz_data=quiz_data,
    )
    return {'reply': reply, 'error': None}

