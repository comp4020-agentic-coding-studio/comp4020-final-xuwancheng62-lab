"""Validate generated alpha cutouts, then prepare inventory WebP assets.

Run with the bundled Python/Pillow runtime:
  python scripts/prepare-item-icons.py /tmp/item-art-manifest.json
No background removal or colour keying is performed.
"""
import json
import sys
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
manifest = json.loads(Path(sys.argv[1]).read_text())
output = root / 'static/img/items'
validated = []
for entry in manifest:
    if 'error' in entry:
        raise ValueError(f"Generation failed: {entry['kind']}: {entry['error']}")
    source = Image.open(entry['path'])
    if 'A' not in source.getbands():
        raise ValueError(f"{entry['kind']}: no alpha channel")
    alpha = source.getchannel('A')
    histogram = alpha.histogram()
    pixels = source.width * source.height
    if histogram[0] / pixels < 0.15 or sum(histogram[1:]) / pixels < 0.02:
        raise ValueError(f"{entry['kind']}: missing transparent canvas or missing object")
    w, h = source.size
    corners = [(0, 0), (w-1, 0), (0, h-1), (w-1, h-1)]
    if any(alpha.getpixel(point) > 16 for point in corners):
        raise ValueError(f"{entry['kind']}: opaque background at corners")
    border = [alpha.getpixel((x, y)) for y in (0, h-1) for x in range(w)]
    border += [alpha.getpixel((x, y)) for x in (0, w-1) for y in range(h)]
    if sum(a > 16 for a in border) / len(border) > 0.03:
        raise ValueError(f"{entry['kind']}: background or object touches canvas edge")
    validated.append((entry, source.convert('RGBA'), histogram[0] / pixels))
# Nothing is copied into the game until the entire set passes alpha checks.
output.mkdir(parents=True, exist_ok=True)
for entry, source, transparent in validated:
    box = source.getchannel('A').point(lambda value: 255 if value > 16 else 0).getbbox()
    cutout = source.crop(box)
    cutout.thumbnail((440, 440), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    canvas.alpha_composite(cutout, ((512-cutout.width)//2, (512-cutout.height)//2))
    target = output / f"{entry['kind']}.webp"
    canvas.save(target, 'WEBP', quality=90, method=6)
    with Image.open(target) as saved:
        if 'A' not in saved.getbands() or saved.getchannel('A').getextrema() != (0, 255):
            raise ValueError(f"{entry['kind']}: saved asset failed alpha validation")
    print(f"{entry['kind']}: RGBA validated, {transparent:.0%} source canvas transparent")
