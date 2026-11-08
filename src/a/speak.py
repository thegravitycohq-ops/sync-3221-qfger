"""One function: text -> int16 mono audio at 24 kHz. FAKE_TTS=1 gives a tone (for tests, no model needed)."""
import os
import numpy as np

SR = 24000
_pipes = {}


def synth(text, voice, speed):
    if os.environ.get("FAKE_TTS"):
        n = int(SR * 0.06 * len(text) / max(speed, 0.5))
        tone = (np.sin(2 * np.pi * 180 * np.arange(n) / SR) * 6000).astype("int16")
        pad = np.zeros(int(SR * 0.3), "int16")  # real voices pad each sentence with silence; the stand-in does too
        return np.concatenate([pad, tone, pad])
    from kokoro import KPipeline  # imported late: heavy, and not needed for tests

    lang = voice[0]  # 'a' = US voices, 'b' = UK voices
    pipe = _pipes.get(lang) or _pipes.setdefault(lang, KPipeline(lang_code=lang))
    parts = [np.asarray(a) for _, _, a in pipe(text, voice=voice, speed=speed) if a is not None]
    if not parts:
        raise RuntimeError("no audio for: " + text[:60])
    return (np.concatenate(parts) * 32767).clip(-32768, 32767).astype("int16")


def trim(a, keep=0.05):
    """Cut the silence a voice leaves before and after a sentence (keeps `keep` seconds), so pauses are exactly the ones we add."""
    if not len(a):
        return a
    lvl = np.abs(a.astype("int32"))
    idx = np.where(lvl > max(120, int(lvl.max() * 0.02)))[0]
    if not len(idx):
        return a
    k = int(keep * SR)
    return a[max(0, idx[0] - k): idx[-1] + k + 1]
