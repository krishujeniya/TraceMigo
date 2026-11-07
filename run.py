#!/usr/bin/env python3
"""TraceMigo Local Runner

Manages the local web server lifecycle (start, stop, status, restart).
Binds to loopback (127.0.0.1) by default.
"""

from __future__ import annotations

import argparse
import http.server
import os
import signal
import socket
import socketserver
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 3000
ROOT_DIR = Path(__file__).resolve().parent
PID_FILE = ROOT_DIR / ".server.pid"


def is_port_in_use(host: str, port: int) -> bool:
    """Check if a network port is already bound."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def read_pid() -> int | None:
    """Read PID from the tracking file if valid."""
    if not PID_FILE.exists():
        return None
    try:
        pid = int(PID_FILE.read_text(encoding="utf-8").strip())
        os.kill(pid, 0)
        return pid
    except (ValueError, OSError):
        PID_FILE.unlink(missing_ok=True)
        return None


def find_pids_on_port(port: int) -> list[int]:
    """Find active process IDs listening on the target port."""
    try:
        output = subprocess.check_output(
            ["fuser", f"{port}/tcp"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return [int(p) for p in output.strip().split() if p.isdigit()]
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []


def stop_server(port: int = DEFAULT_PORT) -> bool:
    """Stop running server processes and remove the PID tracking file."""
    pids: set[int] = set()

    recorded_pid = read_pid()
    if recorded_pid:
        pids.add(recorded_pid)

    port_pids = find_pids_on_port(port)
    pids.update(port_pids)

    if not pids:
        print(f"No running server detected on port {port}.")
        PID_FILE.unlink(missing_ok=True)
        return False

    for pid in pids:
        try:
            os.kill(pid, signal.SIGTERM)
            print(f"Sent SIGTERM to process {pid}.")
        except OSError:
            pass

    time.sleep(0.5)
    for pid in pids:
        try:
            os.kill(pid, 0)
            os.kill(pid, signal.SIGKILL)
            print(f"Sent SIGKILL to process {pid}.")
        except OSError:
            pass

    PID_FILE.unlink(missing_ok=True)
    print("Server stopped successfully.")
    return True


def check_status(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    """Inspect server health, PID status, and responsiveness."""
    pid = read_pid()
    in_use = is_port_in_use(host, port)
    url = f"http://{host}:{port}/"

    if in_use:
        pid_info = f"PID {pid}" if pid else "PID unknown (external process)"
        print(f"Server is active at {url} ({pid_info})")
        try:
            req = urllib.request.Request(url, method="HEAD")
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                print(f"Health check: HTTP {resp.status} OK")
        except Exception as err:
            print(f"Health check warning: {err}")
    else:
        print(f"Server is stopped. Port {port} is free.")
        if PID_FILE.exists():
            PID_FILE.unlink(missing_ok=True)


def run_foreground(host: str, port: int) -> None:
    """Run the HTTP server synchronously in the current terminal."""
    os.chdir(ROOT_DIR)
    handler = http.server.SimpleHTTPRequestHandler

    class ReuseTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    try:
        with ReuseTCPServer((host, port), handler) as httpd:
            PID_FILE.write_text(str(os.getpid()), encoding="utf-8")
            url = f"http://{host}:{port}/"
            print(f"TraceMigo serving at {url} (PID {os.getpid()})")
            print("Press Ctrl+C to stop.")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        PID_FILE.unlink(missing_ok=True)
        print("Server shutdown complete.")


def start_background(host: str, port: int, open_browser: bool) -> None:
    """Launch the HTTP server as a detached background daemon."""
    if is_port_in_use(host, port):
        print(f"Port {port} is already in use. Run 'python3 run.py stop' first.")
        sys.exit(1)

    log_path = ROOT_DIR / ".server.log"
    cmd = [
        sys.executable,
        "-m",
        "http.server",
        str(port),
        "--bind",
        host,
    ]

    with open(log_path, "a", encoding="utf-8") as log_file:
        proc = subprocess.Popen(
            cmd,
            cwd=str(ROOT_DIR),
            stdout=log_file,
            stderr=log_file,
            start_new_session=True,
        )

    PID_FILE.write_text(str(proc.pid), encoding="utf-8")
    time.sleep(0.4)

    if proc.poll() is not None:
        print("Server failed to start. Check .server.log for details.")
        PID_FILE.unlink(missing_ok=True)
        sys.exit(1)

    url = f"http://{host}:{port}/"
    print(f"TraceMigo started in background.")
    print(f"  URL: {url}")
    print(f"  PID: {proc.pid}")
    print(f"  Log: {log_path.name}")
    print("Run 'python3 run.py stop' to terminate.")

    if open_browser:
        launch_browser(url)


def launch_browser(url: str) -> None:
    """Open URL in system browser."""
    try:
        subprocess.Popen(
            ["xdg-open", url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass


def build_parser() -> argparse.ArgumentParser:
    """Construct CLI argument parser."""
    parser = argparse.ArgumentParser(
        description="TraceMigo local server manager.",
    )
    parser.add_argument(
        "action",
        nargs="?",
        default="start",
        choices=["start", "stop", "status", "restart"],
        help="Action to execute (default: start)",
    )
    parser.add_argument(
        "--bg",
        action="store_true",
        help="Run server in the background",
    )
    parser.add_argument(
        "--stop",
        action="store_true",
        help="Shortcut to stop the server",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Server port (default: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help=f"Host address (default: {DEFAULT_HOST})",
    )
    parser.add_argument(
        "--open",
        action="store_true",
        help="Open browser after starting",
    )
    return parser


def main() -> None:
    """Entrypoint dispatcher."""
    parser = build_parser()
    args = parser.parse_args()

    action = "stop" if args.stop else args.action

    if action == "stop":
        stop_server(args.port)
    elif action == "status":
        check_status(args.host, args.port)
    elif action == "restart":
        stop_server(args.port)
        time.sleep(0.5)
        start_background(args.host, args.port, args.open)
    elif action == "start":
        if args.bg:
            start_background(args.host, args.port, args.open)
        else:
            if is_port_in_use(args.host, args.port):
                print(f"Port {args.port} is already in use.")
                print(f"Run 'python3 run.py stop' or specify a different port.")
                sys.exit(1)
            if args.open:
                launch_browser(f"http://{args.host}:{args.port}/")
            run_foreground(args.host, args.port)


if __name__ == "__main__":
    main()
