import json, os, sys, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src", "b"))
os.environ["FAKE_TTS"] = "1"
import prep

S = {
    "meta": {"title": "T", "brand": "B", "slug": "t", "chunk_min": 1},
    "sets": {"camp": {"sky": "dusk", "land": "valley", "things": [["campfire", 0.5, 0.8, 1.2]]}},
    "chapters": [
        {"title": "One", "scenes": [{"art": {"use": "camp", "sky": "night"}, "text": "Dr. Smith woke up. It was cold, and quiet; the fire glowed softly in the dark.\n\nA second paragraph."}, {"text": "Same picture continues. Another sentence here."}]},
        {"title": "Two", "scenes": [{"art": {"land": "coast", "fx": ["mist"]}, "text": "New picture now."}]},
        {"title": "Three", "scenes": [{"art": {"sky": "day"}, "text": "Last one."}]},
    ],
}
with tempfile.TemporaryDirectory() as d:
    p = prep.build({**S, "lexicon": {"quiet": "kwyet"}}, d, ffmpeg=False)
    sc = p["scenes"]
    assert len(sc) == 3, "scene without art must merge into the previous picture"
    assert sc[0]["art"]["sky"] == "night" and sc[0]["art"]["things"], "set merge + override"
    assert sc[0]["s"] == 0 and sc[0]["e"] == sc[1]["s"] and sc[-1]["e"] == p["total"], "scenes contiguous"
    assert all(a["e"] <= b["s"] + 1e-6 for a, b in zip(p["subs"], p["subs"][1:])), "subs do not overlap"
    assert not any("Dr" == s["t"] for s in p["subs"]) and p["subs"][0]["t"].startswith("Dr. Smith"), "abbreviation not split"
    assert all(len(s["t"]) <= 60 for s in p["subs"])
    d0 = open(os.path.join(d, "desc.txt")).read()
    assert "\n0:00 One\n" in d0 and "Three" in d0
    m = json.load(open(os.path.join(d, "matrix.json")))
    assert m[0]["a"] == 0 and m[-1]["b"] == int(p["total"] * 15 + 0.999) - 1 and all(x["b"] + 1 == y["a"] for x, y in zip(m, m[1:])), "chunks cover every frame once"
    assert open(os.path.join(d, "captions.srt")).read().startswith("1\n00:00:02,000 -->")
for bad, msg in [({"meta": {}, "chapters": []}, "meta.title"), ({**S, "chapters": [{"title": "x", "scenes": [{"text": "a"}]}]}, "first scene needs art"),
                 ({**S, "chapters": [{"title": "x", "scenes": [{"art": {"things": [["dragon", 0.5, 0.5]]}, "text": "a"}]}]}, "bad thing")]:
    try:
        prep.validate(bad)
        raise AssertionError("should fail: " + msg)
    except SystemExit as e:
        assert msg in str(e), (msg, str(e))
print("prep tests ok")
