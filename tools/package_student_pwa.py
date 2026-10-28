"""Stamp a byte-bound SW cache and export only the allowlisted PWA, never school data."""
import argparse
import hashlib
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'frontend' / 'hoc'
SHELL_FILES = (
    'index.html', 'styles.css', 'app.js', 'api.js', 'db.js', 'dom.js', 'exam.js', 'fb.js', 'exam-fb.js',
    'thi-app.js', 'thi-store.js', 'presence.js', 'presence-config.js', 'sheet-config.js', 'typing.js', 'read-progress.js', 'support.js', 'support-config.js', 'mastery.js', 'quiz-play.js',
    'manifest.webmanifest', 'fonts/source-serif-4-latin-wght-normal.woff2', 'fonts/source-serif-4-vietnamese-wght-normal.woff2', 'fonts/nunito-latin-wght-normal.woff2', 'fonts/nunito-vietnamese-wght-normal.woff2', 'icons/icon-192.png', 'icons/icon-512.png',
    'icons/maskable-512.png',
)
RELEASE_FILES = SHELL_FILES + ('sw.js', 'teacher.html', 'teacher.js', 'teacher-ui.js', 'teacher.css', 'teacher-thi.js', 'teacher-accounts.js', 'teacher-docs.js', 'teacher-read.js', 'practical.js', 'exam-import.js', 'teacher-effect.js', 'teacher-quiz.js')
CACHE_PATTERN = r"const CACHE = 'aisgk-student-shell-[^']+';"


def cache_declaration(source: Path) -> str:
    checksum = hashlib.sha256()
    for name in SHELL_FILES:
        raw = (source / name).read_bytes()
        if not name.endswith(('.png', '.woff2')):
            raw = raw.replace(b'\r\n', b'\n')
        checksum.update(name.encode('utf-8') + b'\0' + raw + b'\0')
    return f"const CACHE = 'aisgk-student-shell-{checksum.hexdigest()[:24]}';"


def check_shell(source: Path) -> None:
    text = (source / 'sw.js').read_text(encoding='utf-8')
    match = re.search(CACHE_PATTERN, text)
    if match is None or match.group() != cache_declaration(source):
        raise ValueError('SW cache does not match shell bytes; run --stamp before release.')
    for name in RELEASE_FILES:
        if not (source / name).is_file():
            raise ValueError(f'Missing release file: {name}')


def stamp_shell(source: Path) -> None:
    target = source / 'sw.js'
    text, count = re.subn(CACHE_PATTERN, cache_declaration(source), target.read_text(encoding='utf-8'))
    if count != 1:
        raise ValueError('Expected exactly one SW cache declaration.')
    target.write_text(text, encoding='utf-8', newline='\n')


def build_archive(source: Path, destination: Path) -> None:
    check_shell(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in RELEASE_FILES:
            archive.write(source / name, f'hoc/{name}')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stamp', action='store_true', help='Update SW cache to current shell bytes')
    parser.add_argument('--check', action='store_true', help='Check SW cache matches shell bytes without modifying')
    parser.add_argument('--output', type=Path, help='Write an allowlisted ZIP after integrity checks')
    args = parser.parse_args()
    if args.stamp:
        stamp_shell(ROOT)
    check_shell(ROOT)
    if args.output:
        build_archive(ROOT, args.output)
    print(cache_declaration(ROOT))
    print('PWA release files verified; deployment and cloud authorization are separate gates.')


if __name__ == '__main__':
    main()
