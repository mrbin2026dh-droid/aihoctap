"""PWA router composed with the existing authoritative auth dependencies."""
from fastapi import APIRouter, Depends, Header, Response
from fastapi.responses import JSONResponse

from backend import pwa_service as service
from backend.pwa_contracts import AttemptSubmission, PublishLesson, TutorRequest


def create_router(teacher_auth, student_auth) -> APIRouter:
    router = APIRouter(prefix='/api/pwa', tags=['Student PWA'])

    @router.get('/catalog')
    def catalog(if_none_match: str | None = Header(None)):
        result = service.catalog()
        etag = f'"{result["revision"]}"'
        if if_none_match == etag:
            return Response(status_code=304, headers={'ETag': etag})
        from fastapi.responses import JSONResponse
        return JSONResponse(result, headers={'ETag': etag, 'Cache-Control': 'no-cache'})

    @router.get('/lessons/{course_id}/{lesson_id}/{version}')
    def lesson(course_id: str, lesson_id: str, version: str):
        return service.lesson(course_id, lesson_id, version)

    @router.get('/me')
    def me(identity: dict = Depends(student_auth)):
        return {key: identity.get(key) for key in ('uid', 'student_name', 'grade', 'class_code')}

    @router.get('/progress')
    def progress(identity: dict = Depends(student_auth)):
        return service.results(identity['uid'])

    @router.post('/attempts')
    def submit(body: AttemptSubmission, identity: dict = Depends(student_auth)):
        return service.submit(body, identity)

    @router.post('/tutor')
    def tutor(body: TutorRequest):
        return JSONResponse(service.tutor(body), headers={'Cache-Control': 'private, no-store'})


    @router.post('/teacher/publish', dependencies=[Depends(teacher_auth)])
    def publish(body: PublishLesson):
        return service.publish(body)

    @router.get('/teacher/lesson/{course_id}/{lesson_id}', dependencies=[Depends(teacher_auth)])
    def private_lesson(course_id: str, lesson_id: str):
        return service.lesson(course_id, lesson_id, private=True)

    @router.get('/teacher/results', dependencies=[Depends(teacher_auth)])
    def results():
        return service.results()

    return router
