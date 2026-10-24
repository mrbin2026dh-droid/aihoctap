"""Import published content with a completion marker and safe interrupted retries."""
import json
import logging

from pydantic import ValidationError

from backend import grounding
from backend.pwa_contracts import PublishLesson
from backend.pwa_store import configured_path, database

logger = logging.getLogger(__name__)


def seed_if_empty() -> None:
    if configured_path() is None:
        return
    with database() as connection:
        if connection.execute("SELECT 1 FROM settings WHERE key='curriculum_seed_v1'").fetchone():
            return
    from backend.pwa_service import publish
    for path in sorted(grounding.CURRICULUM_V2_DIR.glob('tin[6-9]/bai*.json')):
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
            if data.get('status') != 'published' or not data.get('content_markdown', '').strip():
                continue
            questions = []
            for index, item in enumerate(data.get('quiz', []), 1):
                questions.append({'id': f'q{index}', 'prompt': item['cau_hoi'], 'kind': 'choice',
                                  'options': item['lua_chon'], 'correct_answer': item['dap_an_dung'],
                                  'hint': item.get('goi_y_khi_sai', '')})
            document = PublishLesson.model_validate({
                'subject_id': 'tin-hoc', 'subject_name': 'Tin học', 'grade': data['grade'],
                'lesson_id': f'bai-{data["lesson_id"]}', 'title': data['title'],
                'content_markdown': data['content_markdown'], 'questions': questions})
            publish(document, only_if_missing=True)
        except (ValueError, KeyError, OSError, ValidationError):
            logger.warning('Skipped an invalid published curriculum file: %s', path.name)
    with database(write=True) as connection:
        connection.execute("INSERT OR IGNORE INTO settings VALUES ('curriculum_seed_v1','complete')")
