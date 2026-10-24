"""Transactional PWA storage; never treats an ephemeral cloud path as durable."""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException


def canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def configured_path() -> Path | None:
    durable = os.getenv('PWA_DURABLE_DIRECTORY')
    path = Path(os.getenv('PWA_DATABASE_PATH') or
                (Path(durable) / 'student-pwa.sqlite3' if durable else
                 Path(__file__).resolve().parent.parent / 'scratch' / 'pwa' / 'student-pwa.sqlite3')).resolve()
    if os.getenv('RENDER'):
        if not durable:
            return None
        directory = Path(durable).resolve()
        if not directory.is_dir() or not path.is_relative_to(directory):
            return None
    return path


@contextmanager
def database(write: bool = False):
    path = configured_path()
    if path is None:
        if write:
            raise HTTPException(503, 'Chưa cấu hình nơi lưu bền vững. Liên hệ giáo viên.')
        yield None
        return
    connection = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.executescript('''
            CREATE TABLE IF NOT EXISTS packages (
                course_id TEXT, lesson_id TEXT, version TEXT,
                public TEXT NOT NULL, private TEXT NOT NULL,
                PRIMARY KEY(course_id, lesson_id, version));
            CREATE TABLE IF NOT EXISTS lessons (
                course_id TEXT, lesson_id TEXT, version TEXT, course TEXT NOT NULL,
                PRIMARY KEY(course_id, lesson_id));
            CREATE TABLE IF NOT EXISTS attempts (
                uid TEXT, attempt_id TEXT, body TEXT NOT NULL, ack TEXT NOT NULL,
                record TEXT NOT NULL, PRIMARY KEY(uid, attempt_id));
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        ''')
        with connection:
            if write:
                connection.execute('BEGIN IMMEDIATE')
            yield connection
    except (sqlite3.Error, OSError) as error:
        raise HTTPException(503, 'Không truy cập được nơi lưu bài. Hãy thử lại sau.') from error
    finally:
        if connection is not None:
            connection.close()
