"""Original offline Schwarzschild thin-disc renderer (numpy + Pillow).

Run: python scripts/render-black-hole.py
Units: horizon radius = 1. Null orbit u'' = 1.5*u*u-u, u=1/r.
Observer at infinity, 10 degrees above the disc. RK4 orbit lookup is
intersected with the equatorial plane up to three times. Disc radiance,
colour grading and bloom are artistic, not a calibrated spectral model.
No source code or imagery from BlackHole_STD is incorporated.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

W, H = 1536, 1024
NB, NP = 8192, 2600
DP = 3*np.pi/(NP-1)
bs = np.linspace(.005, 12.1, NB)
u, v = np.zeros(NB), 1/bs
alive = np.ones(NB, dtype=bool)
table = np.zeros((NP, NB), dtype=np.float32)
def acc(q): return 1.5*q*q-q
for j in range(1, NP):
    a = acc(u); b = acc(u+v*DP/2)
    c = acc(u+v*DP/2+a*DP*DP/4)
    d = acc(u+v*DP+b*DP*DP/2)
    un = u+v*DP+(a+b+c)*DP*DP/6
    vn = v+(a+2*b+2*c+d)*DP/6
    alive &= (un > 0) & (un < 1)
    u, v = np.where(alive, un, 0), np.where(alive, vn, 0)
    table[j] = u

y, x = np.mgrid[:H, :W]
x, y = (x+.5-W/2)*20/W, -(y+.5-H/2)*20/W
b = np.maximum(np.hypot(x,y), .005)
elev = np.deg2rad(10)
phi0 = np.mod(np.arctan2(-np.sin(elev)*np.ones_like(y), y/b*np.cos(elev)), np.pi)
bi = np.clip((b-.005)/(12.1-.005)*(NB-1),0,NB-2.001)
b0 = bi.astype(int); bf=bi-b0
rgb = np.zeros((H,W,3)); transmission=np.ones((H,W))
for order in range(3):
    phi=phi0+order*np.pi
    pi=np.clip(phi/DP,0,NP-2.001); p0=pi.astype(int); pf=pi-p0
    inv=(table[p0,b0]*(1-bf)+table[p0,b0+1]*bf)*(1-pf)+(table[p0+1,b0]*(1-bf)+table[p0+1,b0+1]*bf)*pf
    r=1/np.maximum(inv,1e-6)
    valid=(r>3)&(r<9.1)&(inv>0)&(table[p0,b0]>0)&(table[p0+1,b0+1]>0)
    az=np.arctan2(np.cos(phi)*np.cos(elev)-np.sin(phi)*y/b*np.sin(elev), np.sin(phi)*x/b)
    # Zero torque inner rim, tapered outer edge, deterministic sheared filaments.
    heat=np.maximum(0,1-np.sqrt(3/np.maximum(r,3)))*(3/np.maximum(r,3))**3
    flow=1+.12*np.sin(r*18+2*np.sin(az*3)+az*6)+.055*np.sin(r*49+az*11)+.025*np.sin(r*113+az*21)
    taper=np.clip((9.1-r)/2,0,1)
    shift=np.sqrt(np.maximum(.01,1-1/np.maximum(r,1.01)))/(1+.22*x/np.maximum(r,3))
    intensity=heat*42*(.6**order)*flow*taper*shift**3*valid*transmission
    temperature=np.clip((6-r)/4,0,1)
    colour=np.stack([.42+.30*temperature,.60+.30*temperature,np.ones_like(r)],axis=-1)
    rgb+=intensity[...,None]*colour
    transmission*=np.where(valid,.12,1)

# Multi-scale bloom computed once, never a per-frame mobile postprocess.
linear=np.clip(rgb/4,0,1)
source=Image.fromarray(np.uint8(linear*255))
for radius, strength in [(2,.30),(9,.45),(28,.36),(65,.18)]:
    rgb+=np.asarray(source.filter(ImageFilter.GaussianBlur(radius)))/255*strength*np.clip(b/2.4,0,1)[...,None]**5
rgb=(1-np.exp(-rgb*1.25))**(1/2.2)
# The captured-ray shadow occludes stars; elsewhere radiance blends into space.
alpha=np.maximum(rgb.max(axis=2),np.clip((2.598-b)*W/20,0,1))
rgba=np.dstack([rgb/np.maximum(alpha[...,None],1e-8),alpha])
out=Path(__file__).resolve().parents[1]/'src/assets/black-hole.png'
out.parent.mkdir(exist_ok=True)
Image.fromarray(np.uint8(np.clip(rgba,0,1)*255)).save(out,optimize=True)
Image.fromarray(np.uint8(np.clip(rgb,0,1)*255)).save(out.parents[2]/'docs/evidence/black-hole-render.png')
assert np.isfinite(rgba).all()
assert alpha[H//2,W//2] == 1 and rgb[H//2,W//2].max()<.02
print(f'{out.name}: {W}x{H}, {out.stat().st_size} bytes; finite radiance and dark centre verified')
