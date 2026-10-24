import json
from pathlib import Path
from datetime import datetime

root = Path(__file__).resolve().parent.parent
v2_dir = root / 'data' / 'curriculum_v2_simple' / 'tin9'
blocks_dir = root / 'data' / 'curriculum' / 'tin9'
blocks_dir.mkdir(parents=True, exist_ok=True)

page_map = {
    6: [30, 31, 32, 33, 34],
    7: [35, 36, 37, 38, 39],
    8: [40, 41, 42, 43, 44],
    9: [45, 46, 47, 48, 49, 50, 51, 52, 53, 54],
    10: [55, 56, 57, 58, 59]
}

for lesson_id in range(6, 11):
    v2_file = v2_dir / f'bai{lesson_id}.json'
    with open(v2_file, 'r', encoding='utf-8') as f:
        v2_data = json.load(f)
    
    title = v2_data['title']
    topic = v2_data.get('topic', 'Chủ đề 4. Ứng dụng tin học')
    
    blocks_data = {
        'schema_version': '2.0',
        'grade': 9,
        'lesson_id': lesson_id,
        'title': title,
        'status': 'published',
        'source_file': None,
        'extracted_pages': page_map.get(lesson_id, [30, 31]),
        'updated_at': datetime.now().isoformat(),
        'blocks': [
            {
                'type': 'hero',
                'badge': f'BÀI {lesson_id} • TIN HỌC 9',
                'title': title,
                'description': topic
            },
            {
                'type': 'goals',
                'items': [
                    f'Nắm vững lý thuyết cốt lõi của Bài {lesson_id}: {title}.',
                    'Vận dụng thành thạo vào bài tập tình huống thực tế và câu hỏi trắc nghiệm.',
                    'Rèn luyện tư duy tin học và phương pháp giải quyết vấn đề bằng công nghệ.'
                ]
            },
            {
                'type': 'takeaways',
                'title': 'Ghi nhớ trọng tâm',
                'items': [
                    'Chủ động thực hành và đối chiếu kết quả với lý thuyết SGK.',
                    'Ghi nhớ các quy tắc cú pháp và nguyên tắc an toàn số.'
                ]
            }
        ],
        'quiz': v2_data.get('quiz', [])
    }
    
    out_file = blocks_dir / f'bai{lesson_id}.blocks.json'
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(blocks_data, f, ensure_ascii=False, indent=2)
    print(f'Wrote: {out_file}')
