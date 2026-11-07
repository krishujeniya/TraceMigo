"""Check runtime dependencies and imports without executing learner code."""
import ast
from pathlib import Path
import tomllib

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {'dataclasses', 'typing', 'enum', 'math', 'collections', 'json'}
BANNED_CALLS = {'eval', 'exec', 'compile', '__import__', 'open', 'getattr', 'setattr'}


def inspect_source(source):
    errors = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            names = [alias.name.split('.')[0] for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            if node.level:
                if node.level > 1:
                    errors.append("Relative runtime import escapes package")
                continue
            names = [(node.module or '').split('.')[0]]
        else:
            names = []
        errors += [f'Forbidden runtime import: {name}' for name in names if name not in ALLOWED and name != 'tracemigo_python_runtime']
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in BANNED_CALLS:
            errors.append(f'Forbidden runtime authority call: {node.func.id}')
    return errors


def main():
    project = ROOT / 'runtimes/python'
    manifest = tomllib.loads((project / 'pyproject.toml').read_text())
    assert not manifest['project']['dependencies'], 'Runtime dependencies require reviewed allowlist update'
    count = 0
    for file in (project / 'src').rglob('*.py'):
        assert not file.is_symlink()
        errors = inspect_source(file.read_text())
        assert not errors, f'{file}: {errors}'
        count += 1
    for source in ['import os', 'from app.db import client', 'import boto3', 'import importlib', 'eval("1")', '__import__("os")', 'from ...app import db']:
        assert inspect_source(source), 'Negative runtime fixture was accepted'
    assert not inspect_source('from dataclasses import dataclass\nimport typing')
    print(f'Python runtime import/dependency checks passed ({count} files, 7 negative fixtures).')


if __name__ == '__main__':
    main()
