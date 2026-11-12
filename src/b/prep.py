"""Script -> narration + render plan. Never prints script text: CI logs are public.
  prep.py split <dir>        read <dir>/script.json, decide how many voice shards, print them
  prep.py shard <dir> <k> <n>  voice shard k of n -> <dir>/a.flac + <dir>/d.json
  prep.py join  <dir> <n>    read <dir>/s1..sn/{a.flac,d.json} (+ brand.txt) -> plan, audio, captions, metadata
Library use (tests, small jobs): build(script, out) does all three in one process."""
import json, math, os, re, subprocess, sys, zlib
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "a"))
from speak import synth, trim, SR  # noqa: E402

VOCAB = json.load(open(os.path.join(HERE, "..", "r", "vocab.json")))
ABBR = ["Mr.", "Mrs.", "Ms.", "Dr.", "vs.", "etc.", "e.g.", "i.e.", "approx."]
CAMS = ["in", "out", "left", "right", "in", "up"]
T0, TAIL, MAX_JOBS = 2.0, 5.0, 20

# ---------- text ----------
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
        last = out.pop()  # pop first: `out[-2] += out.pop()` re-indexes the shorter list and fails when there are exactly two chunks
        out[-1] += " " + last
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
    if not m.get("title"):
        errs.append("meta.title missing")
    if not 10 <= int(m.get("fps", 15)) <= 30:
        errs.append("meta.fps must be 10..30")
    if int(m.get("res", 720)) not in (720, 1080):
        errs.append("meta.res must be 720 or 1080")
    if m.get("publish", "off") not in ("off", "private", "unlisted", "public"):
        errs.append("meta.publish must be off, private, unlisted or public")
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


def units(script, lexicon=None):
    """Ordered sentences: {ci, art (only on the first sentence of a scene that sets art), text, tts, pe (ends a paragraph)}."""
    lex = [(re.compile(r"\b" + re.escape(k) + r"\b", re.I), v) for k, v in (lexicon or script.get("lexicon") or {}).items()]
    def tts(s):
        for rx, v in lex:
            s = rx.sub(v, s)
        return s
    out = []
    for ci, ch in enumerate(script["chapters"]):
        for si, sc in enumerate(ch["scenes"]):
            art = resolve_art(sc["art"], script.get("sets", {}), "", []) if "art" in sc else None
            for p in re.split(r"\n\s*\n", sc["text"].strip()):
                ss = sentences(p)
                for k, sent in enumerate(ss):
                    out.append({"ci": ci, "si": si, "art": art, "text": sent, "tts": tts(sent), "pe": k == len(ss) - 1})
                    art = None
    return out


def split(us, n):
    """Contiguous ranges of units, balanced by characters."""
    n = max(1, min(n, len(us)))
    tot, ranges, a, acc = sum(len(u["tts"]) for u in us), [], 0, 0
    for i, u in enumerate(us):
        acc += len(u["tts"])
        if len(ranges) < n - 1 and acc >= tot / n * (len(ranges) + 1):
            ranges.append((a, i + 1))
            a = i + 1
    ranges.append((a, len(us)))
    return ranges


def shard_count(script, us):
    chars = sum(len(u["tts"]) for u in us)
    return int(script["meta"].get("shards") or min(MAX_JOBS, max(1, math.ceil(chars / 5500))))


def voice_of(m):
    return m.get("voice", "af_heart"), float(m.get("speed", 0.88)), float(m.get("pause", 0.5)), float(m.get("para", 1.2))


def synth_range(us, m, synth_fn=synth):
    voice, speed, gap, para = voice_of(m)
    parts, counts = [], []
    for k, u in enumerate(us):
        a = trim(synth_fn(u["tts"], voice, speed))
        counts.append(len(a))
        parts += [a, np.zeros(int((para if u["pe"] else gap) * SR), "int16")]
        if (k + 1) % 50 == 0:
            print(f"sentences {k + 1}/{len(us)}", flush=True)
    return np.concatenate(parts), counts

# ---------- pictures that follow the narration ----------
KW = [
    (r"fire|fires|flame|flames|hearth|embers|coals|campfire", "thing", "campfire"), (r"hut|huts|shelter|shelters|house|houses|home|homes|dwelling", "thing", "hut"),
    (r"tent|tents", "thing", "tent"), (r"cabin|cottage", "thing", "cabin"), (r"tree|trees|oak|branches|orchard", "thing", "tree"), (r"pine|pines|conifer", "thing", "pine"),
    (r"palm|palms", "thing", "palm"), (r"stone|stones|rock|rocks|boulder|boulders|flint|pebbles", "thing", "rocks"), (r"cairn|cairns", "thing", "cairn"),
    (r"pyramid|pyramids", "thing", "pyramid"), (r"lighthouse", "thing", "lighthouse"), (r"castle|castles|fortress|tower|towers", "thing", "castle"),
    (r"boat|boats|ship|ships|sail|sails|canoe|vessel", "thing", "boat"), (r"lantern|lamp|candle|candles|torch", "thing", "lantern"),
    (r"herd|herds|bison|deer|animals|mammoths?|cattle|sheep|goats?", "thing", "herd"),
    (r"children|child|family|families|elders?|people|group|together|gather|gathered|friends|villagers|community|everyone", "thing", "group"),
    (r"sleep|sleeping|asleep|rest|resting|lie|lying|blanket|blankets|bed|beds|dream|dreams", "thing", "lying"),
    (r"walk|walks|walking|path|paths|journey|travel|travelled|traveller|wander", "thing", "person"),
    (r"rain|raining|rainfall|drizzle|storm", "fx", "rain"), (r"snow|snowfall|frost|winter|ice", "fx", "snow"), (r"mist|fog|haze", "fx", "mist"),
    (r"bird|birds|geese|swallows|crows|flock|wings", "fx", "birds"), (r"smoke|smoulder|chimney", "fx", "smoke"), (r"firefl(?:y|ies)|glow", "fx", "fireflies"),
]
KW = [(re.compile(r"\b(?:" + p + r")\b", re.I), k, v) for p, k, v in KW]
DEF = {"campfire": [0.55, 0.8, 1.4], "hut": [0.22, 0.62, 0.9], "tent": [0.8, 0.66, 1.0], "cabin": [0.75, 0.64, 0.9], "tree": [0.3, 0.7, 1.2], "pine": [0.25, 0.72, 1.2], "palm": [0.2, 0.8, 1.4],
       "rocks": [0.7, 0.82, 1.3], "cairn": [0.15, 0.8, 1.2], "pyramid": [0.7, 0.6, 1.3], "lighthouse": [0.8, 0.72, 1.4], "castle": [0.7, 0.6, 1.2], "boat": [0.35, 0.56, 1.1],
       "lantern": [0.7, 0.7, 1.0], "herd": [0.4, 0.52, 0.8], "group": [0.5, 0.8, 1.2, 5], "lying": [0.35, 0.8, 1.2], "person": [0.55, 0.8, 1.3]}
BIG = {"pyramid", "castle", "lighthouse", "boat", "herd", "palm", "tree", "pine"}
WIDE = [(1.08, 0.5, 0.5), (1.3, 0.3, 0.62), (1.45, 0.7, 0.6), (1.2, 0.5, 0.7), (1.55, 0.4, 0.7), (1.25, 0.65, 0.55)]

RIVER_LANDS = {"valley"}  # lands whose drawing always includes a river (art.tsx LAND water: 'river')
RIVER_SAFE = 0.24         # ground things stay at least this far (in x) from the river centre


def bank_x(x, y, rx):
    """Push a ground thing out of the river band to the nearest bank (the river winds and widens
    towards the viewer, so the safe margin is generous). Boats and far/horizon things are exempt."""
    if rx is None or y < 0.6 or abs(x - rx) >= RIVER_SAFE:
        return x
    return round(min(0.92, rx + RIVER_SAFE), 3) if x >= rx else round(max(0.08, rx - RIVER_SAFE), 3)


def shot_art(base, text, idx, gi):
    """One <=5 s view of a world: same landscape (same seed), different framing, plus whatever the narration mentions."""
    a = json.loads(json.dumps(base))
    things, fx = a.setdefault("things", []), list(a.get("fx", []))
    river_x = a.get("riverX") if a.get("land") in RIVER_LANDS else None
    jit = (zlib.crc32(f"{base.get('seed')}{gi}".encode()) % 100) / 100 - 0.5
    focus, added = None, False
    for rx, kind, val in KW:
        if not rx.search(text):
            continue
        if kind == "fx":
            if val not in fx and len(fx) < 3:
                fx.append(val)
        elif focus is None:
            if val == "lying" and not (a.get("sky") == "night" or a.get("frame") == "cave"):
                continue
            have = next((t for t in things if t[0] == val), None)
            if not have:
                d = DEF[val]
                have = [val, min(0.9, max(0.1, d[0] + jit * 0.12)), d[1], d[2]] + d[3:]
                things.append(have)
            if val != "boat":
                have[1] = bank_x(have[1], have[2], river_x)
            focus = (1.35 if val in BIG else 1.7, have[1], have[2] - 0.12)
    if river_x is not None:
        for t in things:
            if t[0] != "boat":
                t[1] = bank_x(t[1], t[2], river_x)
    if focus is None:
        base_things = [t for t in things]
        if base_things and idx % 2 == 1:
            t = base_things[(idx // 2) % len(base_things)]
            focus = (1.6, t[1], t[2] - 0.12)
        else:
            focus = WIDE[idx % len(WIDE)]
    a["fx"], a["view"], a["cam"] = fx, {"z": focus[0], "x": round(focus[1], 3), "y": round(focus[2], 3)}, CAMS[gi % len(CAMS)]
    return a


def make_shots(worlds, subs, max_shot, min_shot=2.0):
    shots, gi = [], 0
    for w in worlds:
        S, E = w["s"], w["e"]
        # candidate cut points: the middle of each silence between subtitles (the picture changes while nobody speaks,
        # never on the instant the voice resumes), with the length of that silence
        cands = [((a["e"] + b["s"]) / 2, b["s"] - a["e"]) for a, b in zip(subs, subs[1:]) if S < (a["e"] + b["s"]) / 2 < E]
        bounds, start = [S], S
        while E - start > max_shot + 1e-6:
            win = [c for c in cands if start + min_shot <= c[0] <= start + max_shot]
            good = [c for c in win if c[1] >= 0.25]
            pick = max(good or win, key=lambda c: c[0]) if (good or win) else None
            start = pick[0] if pick else start + max_shot
            bounds.append(start)
        bounds.append(E)
        if len(bounds) > 3 and bounds[-1] - bounds[-2] < 1.2:
            bounds[-2] = (bounds[-3] + bounds[-1]) / 2
        for i in range(len(bounds) - 1):
            s, e = round(bounds[i], 3), round(bounds[i + 1], 3)
            text = " ".join(u["t"] for u in subs if s <= (u["s"] + u["e"]) / 2 < e)
            shots.append({"s": s, "e": e, "art": shot_art(w["art"], text, i, gi)})
            gi += 1
    return shots

# ---------- outputs ----------
def clock(t):
    t = int(t)
    return f"{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}" if t >= 3600 else f"{t // 60}:{t % 60:02d}"


def srt_time(t):
    return f"{int(t // 3600):02d}:{int(t % 3600 // 60):02d}:{int(t % 60):02d},{int(t * 1000) % 1000:03d}"


def clean(s):
    return re.sub(r"[<>]", "", str(s)).strip()


def yt_meta(m, chapters, total):
    tags, size = [], 0
    for t in m.get("tags", []):
        t = clean(t).replace(",", " ")[:30]
        if t and size + len(t) + 3 <= 480:
            tags.append(t)
            size += len(t) + 3
    tag_h = ["#" + re.sub(r"\W", "", t.title()) for t in tags]
    hashtags = [("#" + h.lstrip("#")) for h in (m.get("hashtags") or tag_h[:3])][:5]
    ch = "\n".join(f"{clock(a)} {title}" for title, a in chapters)
    parts = [clean(m.get("description", "")), ch, ("Topics: " + ", ".join(tags[:8])) if tags and m.get("topics_line", True) else "", clean(m.get("footer", "")), " ".join(hashtags)]
    desc = "\n\n".join(p for p in parts if p)[:4800]
    return {"title": clean(m["title"])[:100], "description": desc, "tags": tags, "privacy": m.get("publish", "off"), "category": str(m.get("category", "27")), "lang": m.get("lang", "en-US"), "synthetic": bool(m.get("synthetic", False))}


def thumb_spec(m, worlds, total):
    i = min(max(int(m.get("thumb_scene", 2 if len(worlds) > 1 else 1)) - 1, 0), len(worlds) - 1)
    art = json.loads(json.dumps(worlds[i]["art"]))
    art["view"] = {"z": 1.15, "x": 0.58, "y": 0.58}
    if "thumb_badge" in m:
        badge = m["thumb_badge"]
    else:
        h = total / 3600
        badge = (f"{round(h * 2) / 2:g} HOUR" + ("" if round(h * 2) / 2 == 1 else "S")) if h >= 0.95 else f"{max(1, round(total / 60))} MIN"
    text = m.get("thumb_text") or m["title"]
    return {"art": art, "text": " ".join(clean(text).split()[:5]), "badge": badge}


def assemble(script, us, counts, out, brand=None, ffmpeg=True, audio=None):
    """Timeline, subtitles, pictures, metadata. `audio` = (list of wav parts) is written by the caller via write_audio."""
    validate(script)
    m = script["meta"]
    _, _, gap, para = voice_of(m)
    fps, res = int(m.get("fps", 15)), int(m.get("res", 720))
    t, worlds, subs, chapters, warns, last_ci, lastgap = T0, [], [], [], [], -1, 0.0
    for i, u in enumerate(us):
        if u["ci"] != last_ci:
            chapters.append((script["chapters"][u["ci"]]["title"], 0 if u["ci"] == 0 else t))
            last_ci = u["ci"]
        if u["art"] is not None:
            cut = t - lastgap / 2 if worlds else 0  # change setting in the middle of the pause, not as the voice resumes
            if worlds:
                worlds[-1]["e"] = cut
            art = dict(u["art"])
            art.setdefault("seed", f"{m.get('slug', 'v')}-{len(worlds)}")
            if art.get("land") in RIVER_LANDS and "riverX" not in art:
                art["riverX"] = 0.16 if zlib.crc32(str(art["seed"]).encode()) % 2 == 0 else 0.84
            worlds.append({"s": cut, "art": art})
        if len(u["text"].split()) > 45:
            warns.append(f"chapter {u['ci'] + 1} scene {u['si'] + 1}: a sentence has {len(u['text'].split())} words")
        d, chunks, x = counts[i] / SR, sub_chunks(u["text"] or ""), t
        tot = sum(map(len, chunks))
        for c in chunks:
            subs.append({"s": round(x, 3), "e": round(x + d * len(c) / tot, 3), "t": c})
            x += d * len(c) / tot
        lastgap = int((para if u["pe"] else gap) * SR) / SR
        t += d + lastgap
    total = round(t + TAIL, 3)
    worlds[-1]["e"] = total
    for i, w in enumerate(worlds):
        if w["e"] - w["s"] > 480:
            warns.append(f"setting {i + 1} lasts {(w['e'] - w['s']) / 60:.0f} min: add art to a later scene for variety")
    if len(chapters) < 3 or any(b - a < 10 for (_, a), (_, b) in zip(chapters, chapters[1:] + [("", total)])):
        warns.append("video chapters need 3+ chapters, each 10s or longer")
    max_shot = float(m.get("max_shot", 5.0))
    shots = make_shots(worlds, subs, max_shot)
    if brand is None:
        brand = ""
    plan = {"slug": re.sub(r"[^a-z0-9-]", "", str(m.get("slug", "video")).lower()) or "video", "fps": fps, "width": res * 16 // 9, "height": res, "total": total,
            "brand": brand, "fade": float(m.get("fade", 0.6)), "scenes": shots, "subs": subs}
    meta = yt_meta(m, chapters, total)
    json.dump(plan, open(os.path.join(out, "plan.json"), "w"))
    json.dump(thumb_spec(m, worlds, total), open(os.path.join(out, "thumb.json"), "w"))
    json.dump(meta, open(os.path.join(out, "meta.json"), "w"))
    with open(os.path.join(out, "captions.srt"), "w") as f:
        for i, s in enumerate(subs, 1):
            f.write(f"{i}\n{srt_time(s['s'])} --> {srt_time(s['e'])}\n{s['t']}\n\n")
    with open(os.path.join(out, "desc.txt"), "w") as f:
        f.write(meta["title"] + "\n\n" + meta["description"] + "\n\ntags: " + ", ".join(meta["tags"]) + "\n")
    ft = math.ceil(total * fps)
    cf = max(math.ceil(ft / MAX_JOBS), int(float(m.get("chunk_min", 2)) * 60 * fps))
    matrix = [{"i": k + 1, "a": k * cf, "b": min((k + 1) * cf, ft) - 1} for k in range((ft + cf - 1) // cf)]
    json.dump(matrix, open(os.path.join(out, "matrix.json"), "w"))
    for w in warns:
        print("warn:", w)
    print(f"total {total / 60:.1f} min, {len(worlds)} settings, {len(shots)} shots, {len(subs)} subtitles, {len(matrix)} chunks, {len(us)} sentences")
    return plan


def write_audio(out, segments, ffmpeg=True):
    """segments: iterable of int16 arrays (sentence audio with pauses). Adds lead-in and tail, normalises loudness."""
    w = sf.SoundFile(os.path.join(out, "narration.wav"), "w", SR, 1, "PCM_16")
    w.write(np.zeros(int(T0 * SR), "int16"))
    for s in segments:
        w.write(s)
    w.write(np.zeros(int(TAIL * SR), "int16"))
    w.close()
    if ffmpeg:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(out, "narration.wav"), "-af", "loudnorm=I=-19:TP=-2:LRA=7", "-ac", "1", "-c:a", "aac", "-b:a", "96k", os.path.join(out, "narration.m4a")], check=True)
        os.remove(os.path.join(out, "narration.wav"))


def build(script, out, synth_fn=synth, lexicon=None, ffmpeg=True, brand=None):
    validate(script)
    us = units(script, lexicon)
    audio, counts = synth_range(us, script["meta"], synth_fn)
    write_audio(out, [audio], ffmpeg)
    return assemble(script, us, counts, out, brand)


def _blocks(path):
    with sf.SoundFile(path) as f:
        while True:
            b = f.read(SR * 30, dtype="int16")
            if not len(b):
                return
            yield b


if __name__ == "__main__":
    mode, d = sys.argv[1], sys.argv[2]
    script = json.load(open(os.path.join(d, "script.json")))
    if mode == "split":
        validate(script)
        us = units(script)
        n = len(split(us, shard_count(script, us)))
        print(f"{len(us)} sentences, {n} voice shards")
        if os.environ.get("GITHUB_OUTPUT"):
            open(os.environ["GITHUB_OUTPUT"], "a").write("v=" + json.dumps([{"k": k + 1} for k in range(n)], separators=(",", ":")) + "\nn=" + str(n) + "\n")
    elif mode == "shard":
        k, n = int(sys.argv[3]), int(sys.argv[4])
        us = units(script)
        a, b = split(us, shard_count(script, us))[k - 1]
        audio, counts = synth_range(us[a:b], script["meta"])
        sf.write(os.path.join(d, "a.flac"), audio, SR, subtype="PCM_16")
        json.dump(counts, open(os.path.join(d, "d.json"), "w"))
    elif mode == "join":
        n = int(sys.argv[3])
        counts = [c for k in range(1, n + 1) for c in json.load(open(os.path.join(d, f"s{k}", "d.json")))]
        us = units(script)
        assert len(counts) == len(us), "shard results do not match the script"
        write_audio(d, (b for k in range(1, n + 1) for b in _blocks(os.path.join(d, f"s{k}", "a.flac"))))
        bp = os.path.join(d, "brand.txt")
        assemble(script, us, counts, d, brand=open(bp).read().strip() if os.path.exists(bp) else "")
        if os.environ.get("GITHUB_OUTPUT"):
            open(os.environ["GITHUB_OUTPUT"], "a").write("m=" + json.dumps(json.load(open(os.path.join(d, "matrix.json"))), separators=(",", ":")) + "\n")
