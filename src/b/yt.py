"""Upload video + English (US) captions + thumbnail. Usage: yt.py <dir>
<dir> has video.mp4, captions.srt, meta.json, thumb.jpg (optional). Env: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN.
Prints status codes only (logs are public). Writes <dir>/youtube.json (+ .txt) with the result."""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request

API = os.environ.get("YT_API", "https://www.googleapis.com")
TOKEN_URL = os.environ.get("YT_TOKEN_URL", "https://oauth2.googleapis.com/token")
CHUNK = 32 * 1024 * 1024  # multiple of 256 KiB, as the resumable protocol requires


def call(method, url, headers=None, data=None, tries=5):
    for i in range(tries):
        r = urllib.request.Request(url, data=data, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(r, timeout=300) as x:
                return x.status, dict(x.headers), x.read()
        except urllib.error.HTTPError as e:
            if e.code == 308:
                return 308, dict(e.headers), b""
            if e.code in (429, 500, 502, 503, 504) and i < tries - 1:
                time.sleep(2 ** i)
                continue
            return e.code, dict(e.headers), e.read()
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if i == tries - 1:
                raise
            time.sleep(2 ** i)


def access_token():
    body = urllib.parse.urlencode({"client_id": os.environ["YT_CLIENT_ID"], "client_secret": os.environ["YT_CLIENT_SECRET"], "refresh_token": os.environ["YT_REFRESH_TOKEN"], "grant_type": "refresh_token"}).encode()
    s, _, b = call("POST", TOKEN_URL, {"Content-Type": "application/x-www-form-urlencoded"}, body)
    if s != 200:
        sys.exit(f"token refresh failed: {s}")
    return json.loads(b)["access_token"]


def start_upload(tok, meta, size, lang):
    sn = {"title": meta["title"], "description": meta["description"], "tags": meta["tags"], "categoryId": meta["category"], "defaultLanguage": lang, "defaultAudioLanguage": lang}
    st = {"privacyStatus": meta["privacy"], "selfDeclaredMadeForKids": False}
    if meta.get("synthetic"):
        st["containsSyntheticMedia"] = True
    h = {"Authorization": "Bearer " + tok, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(size)}
    return call("POST", f"{API}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", h, json.dumps({"snippet": sn, "status": st}).encode())


def send_file(loc, path, size):
    pos = 0
    with open(path, "rb") as f:
        while True:
            f.seek(pos)
            data = f.read(CHUNK)
            end = pos + len(data) - 1
            s, h, b = call("PUT", loc, {"Content-Length": str(len(data)), "Content-Range": f"bytes {pos}-{end}/{size}"}, data)
            if s in (200, 201):
                return json.loads(b)["id"]
            if s != 308:
                sys.exit(f"video upload failed: {s}")
            r = h.get("Range") or h.get("range")
            pos = int(r.split("-")[1]) + 1 if r else pos  # resume from what the server has


def captions(tok, vid, srt, lang):
    for code in (lang, lang.split("-")[0]):  # en-US first, plain en if the API refuses it
        meta = {"snippet": {"videoId": vid, "language": code, "name": "English (US)" if code == lang else "English", "isDraft": False}}
        bd = "xxBOUNDARYxx"
        body = (f"--{bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{json.dumps(meta)}\r\n--{bd}\r\nContent-Type: application/octet-stream\r\n\r\n").encode() + open(srt, "rb").read() + f"\r\n--{bd}--".encode()
        s, _, _ = call("POST", f"{API}/upload/youtube/v3/captions?uploadType=multipart&part=snippet", {"Authorization": "Bearer " + tok, "Content-Type": f"multipart/related; boundary={bd}"}, body)
        if s == 200:
            return code
        if s != 400:
            break
    return None


def thumbnail(tok, vid, path):
    s, _, _ = call("POST", f"{API}/upload/youtube/v3/thumbnails/set?videoId={vid}&uploadType=media", {"Authorization": "Bearer " + tok, "Content-Type": "image/jpeg"}, open(path, "rb").read())
    return s


def main(d):
    meta = json.load(open(os.path.join(d, "meta.json")))
    video = os.path.join(d, "video.mp4")
    size = os.path.getsize(video)
    tok, lang = access_token(), meta["lang"]
    s, h, b = start_upload(tok, meta, size, lang)
    if s == 400 and lang != lang.split("-")[0]:  # language code refused: retry with the short one
        lang = lang.split("-")[0]
        s, h, b = start_upload(tok, meta, size, lang)
    if s != 200:
        sys.exit(f"upload start failed: {s}")
    vid = send_file(h.get("Location") or h.get("location"), video, size)
    print("video uploaded")
    info = {"id": vid, "url": f"https://youtu.be/{vid}", "studio": f"https://studio.youtube.com/video/{vid}/edit", "privacy": meta["privacy"]}
    cc = captions(tok, vid, os.path.join(d, "captions.srt"), "en-US")
    print("captions", "ok" if cc else "FAILED (upload captions.srt by hand)")
    info["captions"] = cc or "failed"
    tp = os.path.join(d, "thumb.jpg")
    if os.path.exists(tp):
        s = thumbnail(tok, vid, tp)
        print("thumbnail", "ok" if s == 200 else f"FAILED {s} (needs a phone-verified channel)")
        info["thumbnail"] = "ok" if s == 200 else f"failed ({s})"
    json.dump(info, open(os.path.join(d, "youtube.json"), "w"))
    open(os.path.join(d, "youtube.txt"), "w").write("\n".join(f"{k}: {v}" for k, v in info.items()) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
