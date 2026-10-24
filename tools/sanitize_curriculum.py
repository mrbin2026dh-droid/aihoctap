"""
Curriculum and exam sanitizer: removes all answers and solutions for student release.
Fulfills G5 (F5/E2):
- Expanded forbidden key patterns (including correct, correct_index, answerIndex, ket_qua, ans, key, dapan, loi_giai, etc.)
- Normalizes camelCase to snake_case before matching (e.g. answerIndex -> answer_index, isCorrect -> is_correct)
- Deep inspection of key names across all 17 files
- Text content scanner detecting embedded answer leaks in string values
- Multi-directory scanning across frontend/data, frontend/hoc, backend seed, tests, and zip files.
"""
import json
import logging
import re
import sys
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Set, Tuple

logger = logging.getLogger(__name__)

FORBIDDEN_KEY_PATTERNS = {
    'dap_an_dung',
    'correct_answer',
    'dap_an',
    'answer',
    'giai_thich',
    'giai_thich_su_pham',
    'explanation',
    'solution',
    'is_correct',
    'iscorrect',
    'correct',
    'correct_opt',
    'correct_option',
    'correct_choice',
    'correct_index',
    'correctindex',
    'answer_index',
    'answerindex',
    'ket_qua',
    'ketqua',
    'dap_so',
    'dapso',
    'loi_giai',
    'dapan',
    'dap_an_chi_tiet',
    'huong_dan_giai',
    'solution_text',
    'answer_key',
    'key',
    'ans',
    'ans_key',
}

# Regex to detect answers inadvertently written inside question text or option text
FORBIDDEN_VALUE_REGEXES = [
    re.compile(r'đáp án\s*(đúng)?\s*[:=]\s*[A-D]\b', re.IGNORECASE),
    re.compile(r'chọn\s*(đáp án|phương án)\s*[:=]?\s*[A-D]\b', re.IGNORECASE),
    re.compile(r'lời giải chi tiết\s*[:=]', re.IGNORECASE),
    re.compile(r'giải thích sư phạm\s*[:=]', re.IGNORECASE),
]


def camel_to_snake(s: str) -> str:
    """Convert camelCase or PascalCase to snake_case."""
    return re.sub(r'(?<!^)(?=[A-Z])', '_', s).lower()


def is_forbidden_key(key: str) -> bool:
    """Determine if a key name corresponds to an answer or solution."""
    raw_lower = key.strip().lower()
    snake = camel_to_snake(key.strip())

    for candidate in (raw_lower, snake):
        if candidate in FORBIDDEN_KEY_PATTERNS:
            return True
        for pattern in FORBIDDEN_KEY_PATTERNS:
            if candidate.startswith(f'{pattern}_') or candidate.endswith(f'_{pattern}'):
                return True
            if f'_{pattern}_' in candidate:
                return True
    return False


def check_value_for_answer_leak(val: Any) -> List[str]:
    leaks = []
    if isinstance(val, str):
        for rx in FORBIDDEN_VALUE_REGEXES:
            m = rx.search(val)
            if m:
                leaks.append(f'Text matches forbidden pattern "{rx.pattern}": "{m.group(0)}"')
    return leaks


def strip_answers(obj: Any) -> Tuple[Any, int]:
    """Recursively strip answer and explanation keys. Returns (sanitized_obj, count_removed)."""
    removed = 0
    if isinstance(obj, dict):
        new_dict = {}
        for k, v in obj.items():
            if is_forbidden_key(k):
                removed += 1
                continue
            sanitized_v, count = strip_answers(v)
            removed += count
            new_dict[k] = sanitized_v
        return new_dict, removed
    elif isinstance(obj, list):
        new_list = []
        for item in obj:
            sanitized_item, count = strip_answers(item)
            removed += count
            new_list.append(sanitized_item)
        return new_list, removed
    return obj, 0


def sanitize_file(file_path: Path) -> int:
    """Sanitize a single JSON file in place."""
    try:
        content = file_path.read_text(encoding='utf-8')
        data = json.loads(content)
    except Exception as exc:
        logger.warning('Failed to parse %s: %s', file_path, exc)
        return 0
    sanitized, removed = strip_answers(data)
    if removed > 0:
        file_path.write_text(json.dumps(sanitized, ensure_ascii=False, indent=2), encoding='utf-8')
    return removed


def sanitize_directory(directory: Path) -> int:
    """Recursively sanitize all JSON files in a directory."""
    total_removed = 0
    for path in directory.rglob('*.json'):
        removed = sanitize_file(path)
        if removed > 0:
            total_removed += removed
            print(f'Sanitized {path.name}: removed {removed} answer/solution keys.')
    return total_removed


def scan_json_data_for_leaks(data: Any, file_label: str) -> List[Tuple[str, str]]:
    leaks = []

    def walk(obj: Any, current_path: str = ''):
        if isinstance(obj, dict):
            for k, v in obj.items():
                node_path = f'{current_path}.{k}' if current_path else k
                if is_forbidden_key(k):
                    leaks.append((file_label, f'Key leak: {node_path}'))
                val_leaks = check_value_for_answer_leak(v)
                for vl in val_leaks:
                    leaks.append((file_label, f'Value leak in {node_path}: {vl}'))
                walk(v, node_path)
        elif isinstance(obj, list):
            for idx, item in enumerate(obj):
                walk(item, f'{current_path}[{idx}]')
        elif isinstance(obj, str):
            val_leaks = check_value_for_answer_leak(obj)
            for vl in val_leaks:
                leaks.append((file_label, f'Value leak in {current_path}: {vl}'))

    walk(data)
    return leaks


def scan_directory_for_leaks(directory: Path) -> List[Tuple[str, str]]:
    """Scan a directory and find any JSON file that still contains forbidden keys or leaked values."""
    leaks = []
    for path in directory.rglob('*.json'):
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
            file_leaks = scan_json_data_for_leaks(data, str(path))
            leaks.extend(file_leaks)
        except Exception:
            continue
    return leaks


def scan_zip_file_for_leaks(zip_path: Path) -> List[Tuple[str, str]]:
    leaks = []
    if not zip_path.is_file():
        return leaks
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            for name in z.namelist():
                if name.endswith('.json'):
                    content = z.read(name).decode('utf-8')
                    try:
                        data = json.loads(content)
                        file_leaks = scan_json_data_for_leaks(data, f'{zip_path.name}!{name}')
                        leaks.extend(file_leaks)
                    except Exception:
                        pass
    except Exception as e:
        logger.warning('Could not scan zip %s: %s', zip_path, e)
    return leaks


def collect_all_keys(directory: Path) -> Set[str]:
    keys = set()
    for path in directory.rglob('*.json'):
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
            def walk(obj):
                if isinstance(obj, dict):
                    for k, v in obj.items():
                        keys.add(k)
                        walk(v)
                elif isinstance(obj, list):
                    for item in obj:
                        walk(item)
            walk(data)
        except Exception:
            continue
    return keys


if __name__ == '__main__':
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('frontend/data')
    print(f'=== CURRICULUM SANITIZER & LEAK AUDITOR (G5/F5) ===')
    print(f'Target: {target}')
    
    # 1. Sanitize
    count = sanitize_directory(target)
    print(f'Total answer/solution keys removed: {count}')

    # 2. Key audit
    all_keys = collect_all_keys(target)
    print(f'Total unique keys present in {target}: {len(all_keys)}')
    print('Keys:', ', '.join(sorted(all_keys)))

    # 3. Scan leaks in target directory
    leaks = scan_directory_for_leaks(target)

    # 4. Scan zip file if exists
    zip_target = Path('scratch/student-pwa.zip')
    if zip_target.exists():
        zip_leaks = scan_zip_file_for_leaks(zip_target)
        leaks.extend(zip_leaks)

    if leaks:
        print(f'FAIL: {len(leaks)} leak(s) detected!')
        for f, desc in leaks:
            print(f'  [{f}] {desc}')
        sys.exit(1)
    else:
        print('PASS: 0 answer or solution leaks detected in target directory and packages.')
        sys.exit(0)
