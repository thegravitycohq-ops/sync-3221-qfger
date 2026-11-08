import json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "b"))
os.environ["FAKE_TTS"] = "1"
import prep

LONG = "The fire glows softly in the dark, and the children gather close to listen to the old stories. " * 3
S = {
    "meta": {"title": "T " * 60, "slug": "t", "chunk_min": 1, "tags": ["sleep story", "history, for sleep"], "description": "Hello.", "publish": "private", "thumb_text": "One Two Three Four Five Six Seven"},
    "lexicon": {"quiet": "kwyet"},
    "sets": {"camp": {"sky": "dusk", "land": "valley", "things": [["campfire", 0.5, 0.8, 1.2]]}},
    "chapters": [
        {"title": "One", "scenes": [{"art": {"use": "camp", "sky": "night"}, "text": "Dr. Smith woke up. It was cold, and quiet; the sky was dark.\n\n" + LONG}, {"text": "Same setting continues. A river runs past the old hut. Birds wheel over the water." + " More words follow here." * 4}]},
        {"title": "Two", "scenes": [{"art": {"land": "coast", "fx": ["mist"]}, "text": LONG}]},
        {"title": "Three", "scenes": [{"art": {"sky": "day"}, "text": "Last one."}]},
    ],
}


def check_plan(p):
    sc = p["scenes"]
    assert sc[0]["s"] == 0 and sc[-1]["e"] == p["total"], "shots cover the whole video"
    assert all(a["e"] == b["s"] for a, b in zip(sc, sc[1:])), "shots contiguous"
    assert all(x["e"] - x["s"] <= 5.0 + 1e-6 for x in sc), "no shot longer than 5 s"
    assert all(a["e"] <= b["s"] + 1e-6 for a, b in zip(p["subs"], p["subs"][1:])), "subs do not overlap"


with tempfile.TemporaryDirectory() as d:
    p = prep.build(S, d, ffmpeg=False, brand="Test Brand")
    check_plan(p)
    sc = p["scenes"]
    assert p["brand"] == "Test Brand" and p["slug"] == "t"
    assert len({json.dumps(x["art"]["view"]) for x in sc}) > 3, "views vary shot to shot"
    assert {x["art"]["seed"] for x in sc[:4]} == {"t-0"}, "same world keeps the same landscape"
    fire = [x for x in sc if "fire" in " ".join(u["t"] for u in p["subs"] if x["s"] <= u["s"] < x["e"]).lower()]
    assert fire and all(any(t[0] == "campfire" for t in x["art"]["things"]) and x["art"]["view"]["z"] >= 1.3 for x in fire), "narration about fire frames the fire"
    assert any("birds" in x["art"]["fx"] for x in sc), "narration about birds adds birds"
    assert sc[0]["art"]["sky"] == "night" and sc[0]["art"]["things"], "set merge + override"
    assert p["subs"][0]["t"].startswith("Dr. Smith"), "abbreviation not split"
    m = json.load(open(os.path.join(d, "meta.json")))
    assert len(m["title"]) <= 100 and m["privacy"] == "private" and m["lang"] == "en-US" and "," not in "".join(m["tags"])
    assert "\n0:00 One\n" in m["description"] and m["description"].rstrip().split("\n")[-1].startswith("#"), "chapters + hashtags in description"
    th = json.load(open(os.path.join(d, "thumb.json")))
    assert th["text"] == "One Two Three Four Five" and th["badge"].endswith("MIN"), th
    assert open(os.path.join(d, "captions.srt")).read().startswith("1\n00:00:02,000 -->")
    mx = json.load(open(os.path.join(d, "matrix.json")))
    ft = int(p["total"] * 15 + 0.999)
    assert mx[0]["a"] == 0 and mx[-1]["b"] == ft - 1 and all(x["b"] + 1 == y["a"] for x, y in zip(mx, mx[1:])) and len(mx) <= 20
    p1 = p

# shards + join must give the same plan as one process
with tempfile.TemporaryDirectory() as d:
    S2 = {**S, "meta": {**S["meta"], "shards": 3}}
    us = prep.units(S2)
    rs = prep.split(us, prep.shard_count(S2, us))
    assert len(rs) == 3 and rs[0][0] == 0 and rs[-1][1] == len(us) and all(a[1] == b[0] for a, b in zip(rs, rs[1:])), "ranges cover every sentence once"
    json.dump(S2, open(os.path.join(d, "script.json"), "w"))
    open(os.path.join(d, "brand.txt"), "w").write("Test Brand\n")
    run = lambda *a: subprocess.run([sys.executable, os.path.join(os.path.dirname(prep.__file__), "prep.py"), *a], check=True, capture_output=True, text=True)
    run("split", d)
    for k in (1, 2, 3):
        os.makedirs(os.path.join(d, f"s{k}"))
        sd = os.path.join(d, f"s{k}")
        os.symlink(os.path.join(d, "script.json"), os.path.join(sd, "script.json"))
        run("shard", sd, str(k), "3")
    run("join", d, "3")
    p2 = json.load(open(os.path.join(d, "plan.json")))
    check_plan(p2)
    assert os.path.exists(os.path.join(d, "narration.m4a"))
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(d, "narration.m4a")], capture_output=True, text=True).stdout)
    assert abs(dur - p2["total"]) < 0.3, (dur, p2["total"])
    with tempfile.TemporaryDirectory() as e:
        p3 = prep.build(S2, e, ffmpeg=False, brand="Test Brand")
    assert p2["scenes"] == p3["scenes"] and p2["subs"] == p3["subs"] and p2["brand"] == "Test Brand", "sharded run == single-process run"

for bad, msg in [({"meta": {}, "chapters": []}, "meta.title"), ({**S, "chapters": [{"title": "x", "scenes": [{"text": "a"}]}]}, "first scene needs art"),
                 ({**S, "meta": {**S["meta"], "publish": "everyone"}}, "meta.publish"),
                 ({**S, "chapters": [{"title": "x", "scenes": [{"art": {"things": [["dragon", 0.5, 0.5]]}, "text": "a"}]}]}, "bad thing")]:
    try:
        prep.validate(bad)
        raise AssertionError("should fail: " + msg)
    except SystemExit as e:
        assert msg in str(e), (msg, str(e))
print("prep tests ok")
