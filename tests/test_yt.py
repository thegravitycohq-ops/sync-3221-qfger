import http.server, json, os, sys, tempfile, threading
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "b"))
seen = []
state = {"refuse_enus": False}


class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def reply(self, code, body=b"", headers=None):
        self.send_response(code)
        for k, v in (headers or {}).items(): self.send_header(k, v)
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0)); b = self.rfile.read(n)
        seen.append(("POST", self.path, dict(self.headers), b))
        if self.path == "/token": return self.reply(200, b'{"access_token":"AT"}')
        if self.path.startswith("/upload/youtube/v3/videos"):
            if state["refuse_enus"] and json.loads(b)["snippet"]["defaultLanguage"] == "en-US": return self.reply(400, b"{}")
            return self.reply(200, b"", {"Location": f"http://127.0.0.1:{PORT}/put"})
        if self.path.startswith("/upload/youtube/v3/captions"):
            if b'"language": "en-US"' in b and state["refuse_enus"]: return self.reply(400, b"{}")
            return self.reply(200, b"{}")
        if self.path.startswith("/upload/youtube/v3/thumbnails"): return self.reply(200, b"{}")
        self.reply(404)
    def do_PUT(self):
        n = int(self.headers.get("Content-Length", 0)); b = self.rfile.read(n)
        seen.append(("PUT", self.path, dict(self.headers), len(b)))
        end = int(self.headers["Content-Range"].split("-")[1].split("/")[0]); total = int(self.headers["Content-Range"].split("/")[1])
        if end + 1 < total: return self.reply(308, b"", {"Range": f"bytes=0-{end}"})
        self.reply(200, b'{"id":"VID123"}')


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H); PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
os.environ.update(YT_API=f"http://127.0.0.1:{PORT}", YT_TOKEN_URL=f"http://127.0.0.1:{PORT}/token", YT_CLIENT_ID="i", YT_CLIENT_SECRET="s", YT_REFRESH_TOKEN="r")
import yt
yt.CHUNK = 256 * 1024  # force several chunks in the test

for refuse in (False, True):
    seen.clear(); state["refuse_enus"] = refuse
    with tempfile.TemporaryDirectory() as d:
        open(os.path.join(d, "video.mp4"), "wb").write(os.urandom(700 * 1024))
        open(os.path.join(d, "captions.srt"), "w").write("1\n00:00:00,000 --> 00:00:01,000\nHello\n")
        open(os.path.join(d, "thumb.jpg"), "wb").write(b"\xff\xd8jpg")
        json.dump({"title": "Title", "description": "D\n\n0:00 One", "tags": ["a", "b"], "privacy": "unlisted", "category": "27", "lang": "en-US", "synthetic": True}, open(os.path.join(d, "meta.json"), "w"))
        yt.main(d)
        res = open(os.path.join(d, "youtube.txt")).read()
        info = json.load(open(os.path.join(d, "youtube.json")))
    assert info["url"] == "https://youtu.be/VID123" and info["studio"].endswith("/video/VID123/edit") and info["privacy"] == "unlisted" and info["thumbnail"] == "ok", info
    assert "url: https://youtu.be/VID123" in res
    puts = [s for s in seen if s[0] == "PUT"]
    assert len(puts) == 3 and sum(p[3] for p in puts) == 700 * 1024, "resumable upload in 3 chunks"
    init = [s for s in seen if s[1].startswith("/upload/youtube/v3/videos")][-1]
    snip = json.loads(init[3])
    assert snip["snippet"]["defaultAudioLanguage"] == ("en" if refuse else "en-US") and snip["status"]["privacyStatus"] == "unlisted" and snip["status"]["containsSyntheticMedia"] is True
    assert all(s[2].get("Authorization") == "Bearer AT" for s in seen if s[1].startswith("/upload"))
    cap = [s for s in seen if s[1].startswith("/upload/youtube/v3/captions")]
    assert cap and (b'"language": "en"' in cap[-1][3] if refuse else b'"language": "en-US"' in cap[-1][3]) and b"VID123" in cap[-1][3]
    assert info["captions"] == ("en" if refuse else "en-US")
print("yt tests ok")
