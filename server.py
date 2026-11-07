"""Serveur local pour VERSUS : sert le site + relaie les liens Spotify.

Lancer :  python server.py   puis ouvrir http://localhost:8123
Aucune clé API, aucun compte : la logique Spotify est dans api/spotify.py.
"""
import json
import sys
import urllib.parse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from api.spotify import resolve_request  # noqa: E402

PORT = 8123


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/spotify":
            code, obj = resolve_request(urllib.parse.parse_qs(parsed.query))
            body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    srv = ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=str(ROOT)))
    print(f"VERSUS prêt : http://localhost:{port}  (Ctrl+C pour arrêter)")
    srv.serve_forever()
