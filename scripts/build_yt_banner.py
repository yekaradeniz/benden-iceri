"""Build YouTube banner (2560x1440) from source art, keeping logo within the
1546x423 "All devices" safe zone.
"""
from PIL import Image, ImageFilter
from pathlib import Path

SRC = Path("/Users/yunusemrekaradeniz/Downloads/banner.png")
DST = Path("/Users/yunusemrekaradeniz/Desktop/Deviant/InstaTasavvuf/output/yt-banner.png")

CANVAS_W, CANVAS_H = 2560, 1440
SAFE_W, SAFE_H = 1546, 423

src = Image.open(SRC).convert("RGB")
sw, sh = src.size

target_w = 1480
scale = target_w / sw
target_h = int(sh * scale)
fg = src.resize((target_w, target_h), Image.LANCZOS)

bg_src = src.resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
bg = bg_src.filter(ImageFilter.GaussianBlur(radius=80))

dark = Image.new("RGB", (CANVAS_W, CANVAS_H), (8, 12, 10))
bg = Image.blend(bg, dark, 0.55)

x = (CANVAS_W - target_w) // 2
y = (CANVAS_H - target_h) // 2

mask = Image.new("L", (target_w, target_h), 0)
mask_draw = Image.new("L", (target_w, target_h), 255)
feather = 60
m = Image.new("L", (target_w, target_h), 255)
inner = Image.new("L", (target_w - 2 * feather, target_h - 2 * feather), 255)
m.paste(0, (0, 0, target_w, target_h))
m.paste(255, (feather, feather, target_w - feather, target_h - feather))
m = m.filter(ImageFilter.GaussianBlur(radius=feather / 2))

bg.paste(fg, (x, y), m)

bg.save(DST, "PNG", optimize=True)
print(f"OK: {DST} ({CANVAS_W}x{CANVAS_H})")
print(f"   Banner placed at ({x}, {y}) size {target_w}x{target_h}")
print(f"   Safe zone: center {SAFE_W}x{SAFE_H} = x[{(CANVAS_W-SAFE_W)//2}-{(CANVAS_W+SAFE_W)//2}] y[{(CANVAS_H-SAFE_H)//2}-{(CANVAS_H+SAFE_H)//2}]")
