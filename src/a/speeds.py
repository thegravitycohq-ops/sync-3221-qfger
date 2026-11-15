"""Speed test: one short mp3 per speed in SPEEDS -> samples/. One run samples them all.
Same pattern as samples.py, but the variable is speed instead of voice.
The voice is the channel voice (af_heart) and the text is real production
narration (Medieval 1348, chapter 1) so the sentence-burst shows up exactly
as it will in a render. Usage: speeds.py"""
import os, subprocess, sys
import soundfile as sf
from speak import synth, SR

TEXT = "The lane comes in slowly under a low and heavy sky. Snow lies soft over the roofs, the yards, and the fences. The light is fading early, blue and quiet over everything. The stone church stands with its tower above the small houses."
VOICE = "af_heart"
SPEEDS = [0.68, 0.75, 0.80, 0.85, 0.88, 0.95]
os.makedirs("samples", exist_ok=True)
for s in SPEEDS:
    name = f"speed-{str(s).replace('.', '')}"
    try:
        sf.write("samples/t.wav", synth(TEXT, VOICE, s), SR)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "samples/t.wav", "-b:a", "64k", f"samples/{name}.mp3"], check=True)
        print("ok", name)
    except Exception as e:  # one bad speed must not lose the others
        print("skip", name, str(e)[:80])
os.remove("samples/t.wav")
if not [f for f in os.listdir("samples") if f.endswith(".mp3")]:
    sys.exit("no samples made")
