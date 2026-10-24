"""Release integrity: cache version matches bytes and public artifact is allowlisted."""
import json
import shutil
import zipfile
from pathlib import Path


def test_pwa_release_shell_version_and_manifest_assets():
    from tools.package_student_pwa import ROOT, check_shell
    check_shell(ROOT)
    manifest = json.loads((ROOT / 'manifest.webmanifest').read_text(encoding='utf-8'))
    for icon in manifest['icons']:
        assert (ROOT / icon['src']).is_file()


def test_pwa_archive_excludes_operational_and_legacy_data(tmp_path):
    from tools.package_student_pwa import ROOT, build_archive, stamp_shell
    source = tmp_path / 'hoc'
    shutil.copytree(ROOT, source)
    (source / '.env').write_text('SYNTHETIC_SECRET=must-not-export', encoding='utf-8')
    (source / 'private.json').write_text('{"synthetic_student":"must-not-export"}', encoding='utf-8')
    stamp_shell(source)
    destination = tmp_path / 'student-pwa.zip'
    build_archive(source, destination)
    with zipfile.ZipFile(destination) as archive:
        names = set(archive.namelist())
        assert 'hoc/index.html' in names
        assert 'hoc/teacher.html' in names
        assert all(name.startswith('hoc/') for name in names)
        assert not any('.env' in name or 'private.json' in name or '/data/' in name for name in names)
        assert archive.testzip() is None


def test_changed_shell_is_rejected_until_restamped(tmp_path):
    import pytest
    from tools.package_student_pwa import ROOT, check_shell, stamp_shell
    source = tmp_path / 'hoc'
    shutil.copytree(ROOT, source)
    stamp_shell(source)
    with (source / 'app.js').open('a', encoding='utf-8') as stream:
        stream.write('\n// synthetic release change\n')
    with pytest.raises(ValueError, match='cache'):
        check_shell(source)
    stamp_shell(source)
    check_shell(source)
