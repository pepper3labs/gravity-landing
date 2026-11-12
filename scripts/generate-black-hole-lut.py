"""Generate original light-path data, not a rendered image. numpy/Pillow only."""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
W, H = 2048, 1024
step = 3 * np.pi / (H - 1)
b = np.linspace(.005, 12.1, W)
u, v = np.zeros(W), 1 / b
alive = np.ones(W, dtype=bool)
table = np.zeros((H, W))
for j in range(1, H):
    # Four substeps preserve accuracy near the critical orbit.
    for _ in range(4):
        d = step / 4
        a = 1.5*u*u-u
        q = u+v*d/2
        aa = 1.5*q*q-q
        q = u+v*d/2+a*d*d/4
        ab = 1.5*q*q-q
        q = u+v*d+aa*d*d/2
        ac = 1.5*q*q-q
        un = u+v*d+(a+aa+ab)*d*d/6
        vn = v+(a+2*aa+2*ab+ac)*d/6
        alive &= (un > 0) & (un < 1)
        u, v = np.where(alive, un, 0), np.where(alive, vn, 0)
    table[j] = u
assert np.isfinite(table).all()
packed = np.rint(np.clip(table, 0, 1) * 65535).astype(np.uint16)
rgba = np.zeros((H, W, 4), dtype=np.uint8)
rgba[..., 0] = packed >> 8
rgba[..., 1] = packed & 255
rgba[..., 3] = 255
path = ROOT / 'src/assets/black-hole-orbits.png'
Image.fromarray(rgba).save(path, optimize=True)
print(f'{path.name}: {W}x{H}, {path.stat().st_size} bytes, RG16 inverse radius; alpha opaque')
