#!/usr/bin/env python3
"""
tools/ci/check-canaries.py
Synthetic negative leakage canary test suite for CI Tier 1 and Tier 2.
Verifies that public artifact guards and scanners fail closed upon detecting
secrets, private authorities, source maps, and dotfiles without leaking canary content.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURES_PATH = ROOT / "tools/ci/fixtures/canary-samples.json"
SCANNER_PATH = ROOT / "tools/security/public-artifacts.mjs"


def setup_mock_build_tree(root_dir: Path):
    """Creates a minimal valid build tree required by the scanner."""
    (root_dir / "apps/web/public").mkdir(parents=True, exist_ok=True)
    (root_dir / "apps/web/.next/static").mkdir(parents=True, exist_ok=True)
    (root_dir / "apps/web/.next/server/app").mkdir(parents=True, exist_ok=True)
    (root_dir / "tools/security").mkdir(parents=True, exist_ok=True)

    # Copy the scanner itself so it can run inside the mock root
    shutil.copy(SCANNER_PATH, root_dir / "tools/security/public-artifacts.mjs")

    # Minimal clean build artifacts
    (root_dir / "apps/web/.next/BUILD_ID").write_text("test-canary-build\n")
    (root_dir / "apps/web/public/favicon.ico").write_bytes(b"\x00\x00\x01\x00")
    (root_dir / "apps/web/.next/static/bundle.js").write_text("console.log('clean');\n")
    (root_dir / "apps/web/.next/server/app/page.html").write_text("<html><body>clean</body></html>\n")


def run_scanner(root_dir: Path) -> subprocess.CompletedProcess:
    """Executes the public artifacts scanner against the given root."""
    scanner = root_dir / "tools/security/public-artifacts.mjs"
    return subprocess.run(
        ["node", str(scanner)],
        cwd=root_dir,
        capture_output=True,
        text=True
    )


def test_canaries():
    assert FIXTURES_PATH.exists(), f"Missing fixtures file: {FIXTURES_PATH}"
    fixtures = json.loads(FIXTURES_PATH.read_text())["canaries"]

    temp_dir = Path(tempfile.mkdtemp(prefix="tracemigo-canary-test-"))
    try:
        setup_mock_build_tree(temp_dir)

        # Baseline: clean mock tree must PASS
        clean_res = run_scanner(temp_dir)
        assert clean_res.returncode == 0, f"Clean mock build failed: {clean_res.stderr}"
        print("PASS: Clean mock build passes scanner with exit code 0.")

        # Canary 1: Seeded Secret (TRACEMIGO_PRIVATE_CANARY_...)
        secret_canary = "TRACEMIGO_PRIVATE_CANARY_ABCD1234EFGH5678"
        secret_file = temp_dir / "apps/web/public/canary-secret.txt"
        secret_file.write_text(f"api_key: {secret_canary}\n")
        res1 = run_scanner(temp_dir)
        secret_file.unlink()
        assert res1.returncode != 0, "Scanner failed to reject seeded secret canary"
        assert "private-canary" in res1.stderr, "Expected 'private-canary' rule in failure output"
        assert secret_canary not in res1.stderr and secret_canary not in res1.stdout, "Canary secret was echoed in output"
        print("PASS: Canary 1 (Seeded Secret) rejected without leaking secret content.")

        # Canary 2: Private Key
        key_canary = fixtures["private_key_canary"]["content"]
        key_file = temp_dir / "apps/web/public/server.key.txt"
        key_file.write_text(key_canary)
        res2 = run_scanner(temp_dir)
        key_file.unlink()
        assert res2.returncode != 0, "Scanner failed to reject RSA private key canary"
        assert "private-key" in res2.stderr, "Expected 'private-key' rule in failure output"
        print("PASS: Canary 2 (Private Key) rejected with code 1.")

        # Canary 3: Sealed Answer / Private Authority
        sealed_canary = fixtures["sealed_answer_canary"]["content"]
        sealed_file = temp_dir / "apps/web/.next/server/app/oracle.html"
        sealed_file.write_text(sealed_canary)
        res3 = run_scanner(temp_dir)
        sealed_file.unlink()
        assert res3.returncode != 0, "Scanner failed to reject sealed answer authority canary"
        assert "private-authority" in res3.stderr, "Expected 'private-authority' rule in failure output"
        print("PASS: Canary 3 (Sealed Answer Authority) rejected with code 1.")

        # Canary 4: Source Map
        map_file = temp_dir / "apps/web/.next/static/bundle.js.map"
        map_file.write_text(fixtures["source_map_canary"]["content"])
        res4 = run_scanner(temp_dir)
        map_file.unlink()
        assert res4.returncode != 0, "Scanner failed to reject source map canary"
        assert "forbidden-public-path" in res4.stderr, "Expected 'forbidden-public-path' rule for .map"
        print("PASS: Canary 4 (Source Map) rejected with code 1.")

        # Canary 5: Dotfile (.env.local)
        dotfile = temp_dir / "apps/web/public/.env.local"
        dotfile.write_text(fixtures["dotfile_canary"]["content"])
        res5 = run_scanner(temp_dir)
        dotfile.unlink()
        assert res5.returncode != 0, "Scanner failed to reject dotfile canary"
        assert "forbidden-public-path" in res5.stderr, "Expected 'forbidden-public-path' rule for .env"
        print("PASS: Canary 5 (Dotfile .env.local) rejected with code 1.")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    print("\nALL SYNTHETIC NEGATIVE LEAKAGE CANARIES PASSED.")
    return 0


if __name__ == "__main__":
    sys.exit(test_canaries())
