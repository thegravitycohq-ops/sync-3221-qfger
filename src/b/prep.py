"""Script -> narration audio + render plan. Usage: prep.py <dir>   (reads <dir>/script.json, writes plan.json,
narration.m4a, captions.srt, desc.txt, matrix.json in <dir>). Never prints script text: CI logs are public."""
import json, math, os, re, subprocess, sys
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "a"))
from speak import synth, SR  # noqa: E402

VOCAB = json.load(open(os.path.join(HERE, "..", "r", "vocab.json")))
ABBR = ["Mr.", "Mrs.", "Ms.", "Dr.", "vs.", "etc.", "e.g.", "i.e.", "approx."]
CAMS = ["in", "out", "left", "right", "in", "up"]
T0, TAIL, FADE = 2.0, 5.0, 2.0


def sentences(p):
    for a in ABBR:
        p = p.replace(a, a.replace(".", "\0"))
    return [s.replace("\0", ".").strip() for s in re.split(r'(?<=[.!?…])\s+|(?<=[.!?…]["\')\]])\s+', p) if s.strip()]


def sub_chunks(s, maxc=48):
    out, cur = [], ""
    for w in s.split():
        nxt = (cur + " " + w).strip()
        if cur and len(nxt) > maxc or cur and cur[-1] in ",;:" and len(cur) >= 22:
            out.append(cur)
            cur = w
        else:
            cur = nxt
    if cur:
        out.append(cur)
    if len(out) > 1 and len(out[-1]) < 10:
        out[-2] += " " + out.pop()
    return out


def resolve_art(art, sets, where, errs):
    a = dict(sets.get(art["use"], {}) if "use" in art else {})
    if "use" in art and art["use"] not in sets:
        errs.append(f"{where}: unknown set '{art['use']}'")
    a.update({k: v for k, v in art.items() if k != "use"})
    for k in ("sky", "land", "frame", "cam"):
        if k in a and a[k] not in VOCAB[k]:
            errs.append(f"{where}: {k} '{a[k]}' not in {VOCAB[k]}")
    for f in a.get("fx", []):
        if f not in VOCAB["fx"]:
            errs.append(f"{where}: fx '{f}' not in {VOCAB['fx']}")
    for t in a.get("things", []):
        ok = isinstance(t, list) and len(t) >= 3 and t[0] in VOCAB["things"] and all(isinstance(x, (int, float)) for x in t[1:])
        if not ok:
            errs.append(f"{where}: bad thing {t}")
    return a


def validate(script):
    errs, m = [], script.get("meta", {})
    for k in ("title", "brand"):
        if not m.get(k):
            errs.append(f"meta.{k} missing")
    if not 10 <= int(m.get("fps", 15)) <= 30:
        errs.append("meta.fps must be 10..30")
    if int(m.get("res", 720)) not in (720, 1080):
        errs.append("meta.res must be 720 or 1080")
    chs = script.get("chapters") or []
    if not chs:
        errs.append("no chapters")
    first = True
    for ci, ch in enumerate(chs):
        if not ch.get("title"):
            errs.append(f"chapter {ci + 1}: no title")
        for si, sc in enumerate(ch.get("scenes") or []):
            w = f"chapter {ci + 1} scene {si + 1}"
            if not str(sc.get("text", "")).strip():
                errs.append(f"{w}: no text")
            if first and "art" not in sc:
                errs.append(f"{w}: the first scene needs art")
            first = False
            if "art" in sc:
                resolve_art(sc["art"], script.get("sets", {}), w, errs)
        if not ch.get("scenes"):
            errs.append(f"chapter {ci + 1}: no scenes")
    if errs:
        sys.exit("script problems:\n" + "\n".join(errs[:40]))


def clock(t):
    t = int(t)
    return f"{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60}:{t % 60:02d}"


def srt_time(t):
    return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(t * 1000) % 1000:03d}"


def build(script, out, synth_fn=synth, lexicon=None, ffmpeg=True):
    validate(script)
    m = script["meta"]
    voice, speed = m.get("voice", "af_heart"), float(m.get("speed", 0.88))
    gap, para = float(m.get("pause", 0.6)), float(m.get("para", 1.3))
    fps, res = int(m.get("fps", 15)), int(m.get("res", 720))
    lex = [(re.compile(r"\b" + re.escape(k) + r"\b", re.I), v) for k, v in (lexicon or script.get("lexicon") or {}).items()]
    tts_text = lambda s: [s := rx.sub(v, s) for rx, v in lex][-1] if lex else s
    wav = sf.SoundFile(os.path.join(out, "narration.wav"), "w", SR, 1, "PCM_16")
    sil = lambda s: np.zeros(int(s * SR), "int16")
    wav.write(sil(T0))
    t, scenes, subs, chapters, cur, n, warns = T0, [], [], [], None, 0, []
    for ci, ch in enumerate(script["chapters"]):
        chapters.append((ch["title"], 0 if ci == 0 else t))
        for si, sc in enumerate(ch["scenes"]):
            if "art" in sc:
                if cur:
                    cur["e"] = t
                art = resolve_art(sc["art"], script.get("sets", {}), "", [])
                art.setdefault("seed", f"{m.get('slug', 'v')}-{len(scenes)}")
                art.setdefault("cam", CAMS[len(scenes) % len(CAMS)])
                cur = {"s": 0 if not scenes else t, "art": art}
                scenes.append(cur)
            for p in re.split(r"\n\s*\n", sc["text"].strip()):
                ss = sentences(p)
                for k, sent in enumerate(ss):
                    if len(sent.split()) > 45:
                        warns.append(f"chapter {ci + 1} scene {si + 1}: a sentence has {len(sent.split())} words")
                    a = synth_fn(tts_text(sent), voice, speed)
                    d, chunks, u = len(a) / SR, sub_chunks(sent), t
                    tot = sum(map(len, chunks))
                    for c in chunks:
                        subs.append({"s": round(u, 3), "e": round(u + d * len(c) / tot, 3), "t": c})
                        u += d * len(c) / tot
                    g = para if k == len(ss) - 1 else gap
                    wav.write(a)
                    wav.write(sil(g))
                    t += d + g
                    n += 1
                    if n % 50 == 0:
                        print(f"sentences {n}, {t / 60:.1f} min", flush=True)
    wav.write(sil(TAIL))
    wav.close()
    total = round(t + TAIL, 3)
    cur["e"] = total
    for i, s in enumerate(scenes):
        if s["e"] - s["s"] > 180:
            warns.append(f"picture {i + 1} stays {s['e'] - s['s']:.0f}s: add art to a later scene")
    if len(chapters) < 3 or any(b - a < 10 for (_, a), (_, b) in zip(chapters, chapters[1:] + [("", total)])):
        warns.append("video chapters need 3+ chapters, each 10s or longer")
    plan = {"slug": re.sub(r"[^a-z0-9-]", "", str(m.get("slug", "video")).lower()) or "video", "fps": fps, "width": res * 16 // 9, "height": res, "total": round(total, 3), "brand": m["brand"], "fade": FADE, "scenes": scenes, "subs": subs}
    json.dump(plan, open(os.path.join(out, "plan.json"), "w"))
    with open(os.path.join(out, "captions.srt"), "w") as f:
        for i, s in enumerate(subs, 1):
            f.write(f"{i}\n{srt_time(s['s'])} --> {srt_time(s['e'])}\n{s['t']}\n\n")
    with open(os.path.join(out, "desc.txt"), "w") as f:
        f.write(m["title"] + "\n\n" + m.get("description", "") + "\n\n" + "\n".join(f"{clock(a)} {title}" for title, a in chapters))
        f.write("\n\ntags: " + ", ".join(m.get("tags", [])) + "\n")
    cf = int(float(m.get("chunk_min", 10)) * 60 * fps)
    ft = math.ceil(total * fps)
    matrix = [{"i": k + 1, "a": k * cf, "b": min((k + 1) * cf, ft) - 1} for k in range((ft + cf - 1) // cf)]
    json.dump(matrix, open(os.path.join(out, "matrix.json"), "w"))
    if ffmpeg:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(out, "narration.wav"), "-af", "loudnorm=I=-19:TP=-2:LRA=7", "-ac", "1", "-c:a", "aac", "-b:a", "96k", os.path.join(out, "narration.m4a")], check=True)
        os.remove(os.path.join(out, "narration.wav"))
    for w in warns:
        print("warn:", w)
    print(f"total {total / 60:.1f} min, {len(scenes)} pictures, {len(subs)} subtitles, {len(matrix)} chunks, {n} sentences")
    return plan


if __name__ == "__main__":
    d = sys.argv[1]
    build(json.load(open(os.path.join(d, "script.json"))), d)
    if os.environ.get("GITHUB_OUTPUT"):
        open(os.environ["GITHUB_OUTPUT"], "a").write("m=" + json.dumps(json.load(open(os.path.join(d, "matrix.json"))), separators=(",", ":")) + "\n")
