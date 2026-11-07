#!/usr/bin/env python3
"""TraceMigo Local Preview Runner

Manages the standalone static preview server lifecycle (start, stop, status, restart).
Binds to loopback (127.0.0.1) by default and strictly serves index.html.
"""

from __future__ import annotations

import argparse
import http.server
import json
import os
import posixpath
import signal
import socket
import socketserver
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 3000
ROOT_DIR = Path(__file__).resolve().parent
INDEX_FILE = ROOT_DIR / "index.html"
PID_FILE = ROOT_DIR / ".server.pid"
STATE_FILE = ROOT_DIR / ".server.json"


def is_port_in_use(host: str, port: int) -> bool:
    """Check if a network port is already bound."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def is_pid_owned(pid: int) -> bool:
    """Verify that a PID belongs to an active TraceMigo preview server."""
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False

    cmdline_path = Path(f"/proc/{pid}/cmdline")
    if cmdline_path.exists():
        try:
            cmdline = cmdline_path.read_text(encoding="utf-8", errors="ignore")
            return "run.py" in cmdline or "TraceMigoPreview" in cmdline
        except OSError:
            pass

    try:
        output = subprocess.check_output(
            ["ps", "-p", str(pid), "-o", "args="],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return "run.py" in output or "TraceMigoPreview" in output
    except Exception:
        return False


def read_server_state() -> dict | None:
    """Read PID and server state from tracking files with validation."""
    if not STATE_FILE.exists():
        if PID_FILE.exists():
            try:
                pid = int(PID_FILE.read_text(encoding="utf-8").strip())
                if pid > 0 and is_pid_owned(pid):
                    return {"pid": pid, "host": DEFAULT_HOST, "port": DEFAULT_PORT}
            except (ValueError, OSError):
                pass
            PID_FILE.unlink(missing_ok=True)
        return None

    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("pid"), int) and data["pid"] > 0:
            if is_pid_owned(data["pid"]):
                return data
    except Exception:
        pass

    cleanup_server_state()
    return None


def write_server_state(pid: int, host: str, port: int) -> None:
    """Write verified process tracking metadata."""
    state = {
        "pid": pid,
        "host": host,
        "port": port,
        "started_at": time.time(),
    }
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
    PID_FILE.write_text(str(pid), encoding="utf-8")


def cleanup_server_state() -> None:
    """Safely unlink tracking files."""
    STATE_FILE.unlink(missing_ok=True)
    PID_FILE.unlink(missing_ok=True)


class StandalonePreviewHandler(http.server.BaseHTTPRequestHandler):
    """Restricted HTTP handler serving strictly index.html without directory traversal."""

    server_version = "TraceMigoPreview/1.0"
    sys_version = ""

    def log_message(self, format: str, *args: object) -> None:
        if os.environ.get("TRACEMIGO_PREVIEW_SILENT"):
            return
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")

    def _send_error_response(self, code: int, message: str) -> None:
        body = f"{code} {message}\n".encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_HEAD(self) -> None:
        self._handle_request()

    def do_GET(self) -> None:
        self._handle_request()

    def _handle_request(self) -> None:
        parsed = urllib.parse.urlsplit(self.path)
        raw_path = parsed.path
        unquoted = urllib.parse.unquote(raw_path)

        if ".." in unquoted or "\0" in unquoted or "\\" in unquoted:
            self._send_error_response(403, "Forbidden")
            return

        lower = unquoted.lower()
        denied_prefixes = (
            "/planning",
            "/.",
            "/packages",
            "/apps",
            "/services",
            "/tools",
            "/docs",
            "/infra",
            "/runtimes",
            "/node_modules",
        )
        if lower.startswith(denied_prefixes):
            self._send_error_response(404, "Not Found")
            return

        clean_path = posixpath.normpath(unquoted)

        if clean_path in ("/", "/index.html"):
            if not INDEX_FILE.is_file():
                self._send_error_response(404, "Not Found")
                return
            try:
                content = INDEX_FILE.read_bytes()
            except OSError:
                self._send_error_response(500, "Internal Server Error")
                return

            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            if self.command == "GET":
                self.wfile.write(content)
            return

        if clean_path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return

        self._send_error_response(404, "Not Found")

    def do_POST(self) -> None:
        self._send_error_response(405, "Method Not Allowed")

    def do_PUT(self) -> None:
        self._send_error_response(405, "Method Not Allowed")

    def do_DELETE(self) -> None:
        self._send_error_response(405, "Method Not Allowed")

    def do_OPTIONS(self) -> None:
        self._send_error_response(405, "Method Not Allowed")


def stop_server(port: int = DEFAULT_PORT) -> bool:
    """Stop only verified owned preview server processes."""
    state = read_server_state()
    if not state:
        if is_port_in_use(DEFAULT_HOST, port):
            print(f"Port {port} is in use by an unmanaged process. TraceMigo will not terminate foreign processes.")
        else:
            print("No running TraceMigo preview server detected.")
        cleanup_server_state()
        return False

    pid = state["pid"]
    if not is_pid_owned(pid):
        print(f"Recorded PID {pid} is not a running TraceMigo preview server. Cleaning stale state.")
        cleanup_server_state()
        if is_port_in_use(state.get("host", DEFAULT_HOST), port):
            print(f"Port {port} remains in use by an external listener.")
        return False

    print(f"Stopping TraceMigo preview server (PID {pid})...")
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError:
        cleanup_server_state()
        return True

    deadline = time.time() + 2.0
    while time.time() < deadline:
        try:
            os.kill(pid, 0)
            time.sleep(0.1)
        except OSError:
            break
    else:
        try:
            os.kill(pid, signal.SIGKILL)
            print(f"Sent SIGKILL to process {pid}.")
        except OSError:
            pass

    cleanup_server_state()
    print("TraceMigo preview server stopped successfully.")
    return True


def check_status(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    """Inspect server health, PID status, and responsiveness."""
    state = read_server_state()
    in_use = is_port_in_use(host, port)
    url = f"http://{host}:{port}/"

    if in_use:
        if state and is_pid_owned(state["pid"]):
            pid_info = f"PID {state['pid']} (verified owned)"
        else:
            pid_info = "PID unknown (unmanaged external process)"
        print(f"Server is active at {url} ({pid_info})")
        try:
            req = urllib.request.Request(url, method="HEAD")
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                print(f"Health check: HTTP {resp.status} OK")
        except Exception as err:
            print(f"Health check warning: {err}")
    else:
        print(f"Server is stopped. Port {port} is free.")
        cleanup_server_state()


def run_foreground(host: str, port: int, write_pid: bool = True) -> None:
    """Run the HTTP server synchronously in the current terminal."""
    class ReuseTCPServer(socketserver.TCPServer):
        allow_reuse_address = True

    try:
        with ReuseTCPServer((host, port), StandalonePreviewHandler) as httpd:
            if write_pid:
                write_server_state(os.getpid(), host, port)
            url = f"http://{host}:{port}/"
            print(f"TraceMigo preview server running at {url} (PID {os.getpid()})")
            print("Serving index.html strictly. Press Ctrl+C to stop.")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping preview server...")
    finally:
        if write_pid:
            cleanup_server_state()
        print("Preview server shutdown complete.")


def start_background(host: str, port: int, open_browser: bool) -> None:
    """Launch the HTTP server as a detached background worker."""
    if is_port_in_use(host, port):
        print(f"Port {port} is already in use. Run 'python3 run.py stop' or specify a different port.")
        sys.exit(1)

    log_path = ROOT_DIR / ".server.log"
    cmd = [
        sys.executable,
        str(Path(__file__).resolve()),
        "start",
        "--host",
        host,
        "--port",
        str(port),
        "--worker",
    ]

    with open(log_path, "a", encoding="utf-8") as log_file:
        proc = subprocess.Popen(
            cmd,
            cwd=str(ROOT_DIR),
            stdout=log_file,
            stderr=log_file,
            start_new_session=True,
        )

    write_server_state(proc.pid, host, port)
    time.sleep(0.4)

    if proc.poll() is not None:
        print("Server failed to start. Check .server.log for details.")
        cleanup_server_state()
        sys.exit(1)

    url = f"http://{host}:{port}/"
    print("TraceMigo preview server started in background.")
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
        description="TraceMigo local standalone preview server manager.",
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
    parser.add_argument(
        "--worker",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    return parser


def main() -> None:
    """Entrypoint dispatcher."""
    parser = build_parser()
    args = parser.parse_args()

    action = "stop" if args.stop else args.action

    if args.worker:
        run_foreground(args.host, args.port, write_pid=False)
        return

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
                print("Run 'python3 run.py stop' or specify a different port.")
                sys.exit(1)
            if args.open:
                launch_browser(f"http://{args.host}:{args.port}/")
            run_foreground(args.host, args.port)


if __name__ == "__main__":
    main()
