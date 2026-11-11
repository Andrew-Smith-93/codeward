"""Offline regression: default shallow PR checkout cannot resolve the base."""
import pathlib
import subprocess
import tempfile


def git(cwd, *args, ok=True):
    return subprocess.run(['git', '-C', str(cwd), *args], check=ok,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


workflow = pathlib.Path('.github/workflows/ci.yml').read_text()
assert 'fetch-depth: 0' in workflow
assert 'persist-credentials: false' in workflow
assert 'review --unstaged' not in workflow
with tempfile.TemporaryDirectory(prefix='codeward-ci-history-') as root:
    root = pathlib.Path(root)
    source = root / 'source'
    source.mkdir()
    git(source, 'init', '-b', 'main')
    git(source, 'config', 'user.email', 'fixture@example.invalid')
    git(source, 'config', 'user.name', 'Offline fixture')
    (source / 'file.txt').write_text('base\n')
    git(source, 'add', '.')
    git(source, 'commit', '-m', 'base')
    git(source, 'checkout', '-b', 'candidate')
    (source / 'file.txt').write_text('candidate\n')
    git(source, 'commit', '-am', 'candidate')
    shallow = root / 'shallow'
    git(root, 'clone', '--depth', '1', '--branch', 'candidate', source.as_uri(), str(shallow))
    assert git(shallow, 'diff', 'origin/main...HEAD', ok=False).returncode != 0
    full = root / 'full'
    git(root, 'clone', source.as_uri(), str(full))
    diff = git(full, 'diff', 'origin/main...HEAD').stdout
    assert '+candidate' in diff and '-base' in diff
print('PASS: shallow checkout reproduces missing base; full history yields real PR diff')
