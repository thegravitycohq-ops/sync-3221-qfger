"""Tileable paper grain + soft watercolour blotches -> public/paper.png (grey, multiplied over the picture)."""
import numpy as np
from PIL import Image
import os
os.makedirs("public", exist_ok=True)
N = 512
rng = np.random.default_rng(7)
def band(sigma):
    f = np.fft.fft2(rng.standard_normal((N, N)))
    k = np.fft.fftfreq(N)
    kk = np.sqrt(k[:, None] ** 2 + k[None, :] ** 2)
    a = np.real(np.fft.ifft2(f * np.exp(-(kk * sigma) ** 2)))
    return (a - a.mean()) / a.std()
img = 232 + 7 * band(1.5) + 5 * band(9) + 3 * band(40)
Image.fromarray(np.clip(img, 0, 255).astype("uint8")).save("public/paper.png")
