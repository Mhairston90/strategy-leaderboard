from __future__ import annotations

import argparse
import urllib.parse
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# Same external sources as lib/fetch.js. The browser cannot fetch these
# directly: the Apps Script /exec endpoint 302-redirects WITHOUT a CORS
# Access-Control-Allow-Origin header, so the browser blocks it on the redirect
# hop (Node/PowerShell don't enforce CORS, which is why the smoke test passes
# but the dashboard shows ERROR rows). We proxy them through this same-origin
# server, which fetches server-side (no CORS in play) and relays the body.
SHEET_BASE = "https://script.google.com/macros/s/AKfycbyVLBnBLtremcupVRW-9B7a9tST7CpjTZQPr8OWxeGvMfs17Md53u01yFks8Y4uQ4ny/exec"
BULL_RAW_BASE = "https://raw.githubusercontent.com/Mhairston90/trading-bull/refs/heads/main"
PROXY_TIMEOUT_S = 20


class QuietHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format: str, *args: object) -> None:
        return

    # --- Same-origin proxy for external data sources --------------------------
    def do_GET(self) -> None:  # noqa: N802 (stdlib naming)
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/proxy/sheet":
            return self._proxy_sheet(parsed)
        if parsed.path == "/proxy/bull":
            return self._proxy_bull(parsed)
        return super().do_GET()

    def _relay(self, upstream_url: str, content_type: str) -> None:
        try:
            req = urllib.request.Request(upstream_url, headers={"User-Agent": "leaderboard-proxy"})
            with urllib.request.urlopen(req, timeout=PROXY_TIMEOUT_S) as resp:
                body = resp.read()
        except Exception as exc:  # upstream down / timeout -> 502 so the client shows a real error
            msg = f"proxy upstream error: {exc}".encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _proxy_sheet(self, parsed: urllib.parse.SplitResult) -> None:
        params = urllib.parse.parse_qs(parsed.query)
        tab = (params.get("tab") or [""])[0]
        limit = (params.get("limit") or ["200"])[0]
        query = urllib.parse.urlencode({"tab": tab, "limit": limit})
        self._relay(f"{SHEET_BASE}?{query}", "application/json; charset=utf-8")

    def _proxy_bull(self, parsed: urllib.parse.SplitResult) -> None:
        params = urllib.parse.parse_qs(parsed.query)
        rel = (params.get("path") or [""])[0]
        # Safety: only allow simple repo-relative paths (no traversal / no scheme).
        if not rel or ".." in rel or "://" in rel or rel.startswith("/"):
            self.send_error(400, "bad path")
            return
        safe = urllib.parse.quote(rel)
        self._relay(f"{BULL_RAW_BASE}/{safe}", "text/plain; charset=utf-8")


class LeaderboardHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8123)
    parser.add_argument("--directory", default=".")
    parser.add_argument("--bind", default="127.0.0.1")
    args = parser.parse_args()

    directory = Path(args.directory).resolve()
    handler = partial(QuietHTTPRequestHandler, directory=str(directory))
    server = LeaderboardHTTPServer((args.bind, args.port), handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
