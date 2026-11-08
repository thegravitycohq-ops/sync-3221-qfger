"""Voice test: one short mp3 per voice in voices.json -> samples/. Usage: samples.py [speed]"""
import json, os, subprocess, sys
import soundfile as sf
from speak import synth, SR

TEXT = "The afternoon light moved slowly across the floor, and the house was quiet. Somewhere far away a river kept on running, as it always had."
speed = float(sys.argv[1]) if len(sys.argv) > 1 else 0.88
here = os.path.dirname(__file__)
os.makedirs("samples", exist_ok=True)
for v in json.load(open(os.path.join(here, "voices.json"))):
    try:
        sf.write("samples/t.wav", synth(TEXT, v["id"], speed), SR)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "samples/t.wav", "-b:a", "64k", f"samples/{v['id']}.mp3"], check=True)
        print("ok", v["id"])
    except Exception as e:  # one bad voice must not lose the others
        print("skip", v["id"], str(e)[:80])
os.remove("samples/t.wav")
if not [f for f in os.listdir("samples") if f.endswith(".mp3")]:
    sys.exit("no samples made")
