#!/usr/bin/env python3
"""Synthetic regression check suite for TraceMigo standalone preview server."""

from __future__ import annotations

import os
import signal
import socket
import socketserver
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import run  # noqa: E402


def test_http_endpoints(port: int) -> None:
    """Verify positive serving and strict negative security denials."""
    base_url = f"http://127.0.0.1:{port}"

    # 1. Positive: GET /
    req = urllib.request.Request(f"{base_url}/")
    with urllib.request.urlopen(req, timeout=2.0) as resp:
        assert resp.status == 200, f"Expected 200 for /, got {resp.status}"
        body = resp.read().decode("utf-8")
        assert "TraceMigo" in body, "Expected TraceMigo in / response"
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert "text/html" in resp.headers.get("Content-Type", "")

    # 2. Positive: HEAD /
    req_head = urllib.request.Request(f"{base_url}/", method="HEAD")
    with urllib.request.urlopen(req_head, timeout=2.0) as resp:
        assert resp.status == 200, f"Expected 200 for HEAD /, got {resp.status}"
        assert resp.read() == b"", "HEAD response body must be empty"

    # 3. Positive: GET /index.html
    req_index = urllib.request.Request(f"{base_url}/index.html")
    with urllib.request.urlopen(req_index, timeout=2.0) as resp:
        assert resp.status == 200, f"Expected 200 for /index.html, got {resp.status}"

    # 4. Positive: GET /favicon.ico -> 204
    req_fav = urllib.request.Request(f"{base_url}/favicon.ico")
    with urllib.request.urlopen(req_fav, timeout=2.0) as resp:
        assert resp.status == 204, f"Expected 204 for /favicon.ico, got {resp.status}"

    # 5. Negative security checks: must return 403 or 404, never 200
    negative_paths = [
        "/planning/tracker.md",
        "/.env",
        "/.git/config",
        "/run.py",
        "/package.json",
        "/tools/check_python.py",
        "/..%2f..%2fetc%2fpasswd",
        "/../run.py",
        "/apps/web/package.json",
        "/docs/adr/README.md",
    ]

    for path in negative_paths:
        url = f"{base_url}{path}"
        try:
            req_neg = urllib.request.Request(url)
            with urllib.request.urlopen(req_neg, timeout=2.0) as resp:
                raise AssertionError(f"Security violation: {url} returned HTTP {resp.status}")
        except urllib.error.HTTPError as err:
            assert err.code in (403, 404), f"Expected 403 or 404 for {url}, got {err.code}"

    # 6. Negative HTTP methods: POST / PUT / DELETE
    for method in ["POST", "PUT", "DELETE"]:
        try:
            req_m = urllib.request.Request(f"{base_url}/", data=b"data", method=method)
            with urllib.request.urlopen(req_m, timeout=2.0) as resp:
                raise AssertionError(f"Expected 405 for {method}, got {resp.status}")
        except urllib.error.HTTPError as err:
            assert err.code == 405, f"Expected 405 for {method}, got {err.code}"

    print("PASS: HTTP endpoints correctly serve preview and deny private/traversal paths.")


def test_lifecycle_and_process_ownership() -> None:
    """Verify server startup, PID verification, and foreign process safety."""
    # Step A: Create a synthetic unrelated TCP listener
    class DummyHandler(socketserver.BaseRequestHandler):
        def handle(self) -> None:
            pass

    dummy_server = socketserver.TCPServer(("127.0.0.1", 0), DummyHandler)
    dummy_port = dummy_server.server_address[1]
    dummy_thread = threading.Thread(target=dummy_server.serve_forever, daemon=True)
    dummy_thread.start()

    try:
        assert run.is_port_in_use("127.0.0.1", dummy_port)

        # Attempt to stop unowned server on dummy_port
        stopped = run.stop_server(dummy_port)
        assert stopped is False, "stop_server must refuse to stop unmanaged foreign process"

        # Verify dummy server is STILL alive
        assert run.is_port_in_use("127.0.0.1", dummy_port), "Foreign listener must not be killed"
        print("PASS: Foreign port listener survived stop_server safely.")
    finally:
        dummy_server.shutdown()
        dummy_server.server_close()

    # Step B: Test actual TraceMigo preview server lifecycle
    test_port = 3099
    if run.is_port_in_use("127.0.0.1", test_port):
        run.stop_server(test_port)

    # Launch background server
    run.start_background("127.0.0.1", test_port, open_browser=False)
    time.sleep(0.5)

    try:
        assert run.is_port_in_use("127.0.0.1", test_port), "Server failed to bind"
        state = run.read_server_state()
        assert state is not None, "Missing server state"
        assert run.is_pid_owned(state["pid"]), f"PID {state['pid']} should be verified owned"

        # Test HTTP endpoints while running
        test_http_endpoints(test_port)

        # Verify status output
        run.check_status("127.0.0.1", test_port)
    finally:
        # Graceful stop
        stopped = run.stop_server(test_port)
        assert stopped is True, "Expected stop_server to succeed for owned preview process"
        assert not run.is_port_in_use("127.0.0.1", test_port), "Server port should be free"
        assert run.read_server_state() is None, "State tracking files should be cleaned up"
        print("PASS: TraceMigo preview lifecycle and verified process ownership confirmed.")


def main() -> None:
    print("Running TraceMigo standalone preview server verification...")
    os.environ["TRACEMIGO_PREVIEW_SILENT"] = "1"
    test_lifecycle_and_process_ownership()
    print("ALL PREVIEW SERVER CHECKS PASSED.")


if __name__ == "__main__":
    main()
