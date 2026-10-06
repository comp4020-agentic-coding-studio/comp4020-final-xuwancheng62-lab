# Cuts the generated equipment out of its green background and crops the
# ladder to a whole number of rungs so it tiles up the shaft. Run once with
# Pillow, numpy and scipy (a throwaway venv; not a dependency of the app):
#   python cut-shelter-art.py <generator.png> <purifier.png> <ladder.png> <out dir>
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

gen, pur, lad, out = sys.argv[1:5]

def cut(src, dst, width, floor_from, shadow):
    im = np.asarray(Image.open(src).convert("RGB")).astype(float)
    bg = np.median(np.concatenate([im[:8].reshape(-1, 3), im[:, :8].reshape(-1, 3), im[:, -8:].reshape(-1, 3)]), axis=0)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    dist = np.sqrt(((im - bg) ** 2).sum(-1))
    # background: close to the sampled green, or green as bright as it (an olive body is darker and stays)
    bright = (r + g + b) / 3
    greenish = (g > r + 25) & (g > b + 25) & (bright > bg.mean() * 0.9)
    keep = (dist > 60) & ~greenish
    # the floor line and cast shadow along the bottom: pale, or (for a shadow) cooler than the rusty metal
    low = np.zeros_like(keep)
    low[int(len(keep) * floor_from):] = True
    keep &= ~(low & ((bright > 165) | (shadow & (b > r + 5))))
    keep = ndimage.binary_opening(keep, iterations=2)
    labels, n = ndimage.label(keep)
    sizes = ndimage.sum(keep, labels, range(1, n + 1))
    keep = np.isin(labels, 1 + np.flatnonzero(sizes > sizes.max() * 0.02))
    # enclosed patches are the object's own pale paint, unless they really are the green showing through
    holes = ndimage.binary_fill_holes(keep) & ~keep
    keep |= holes & (dist > 40)
    alpha = ndimage.gaussian_filter(keep.astype(float), 0.8)
    # pull leftover green out of the edges
    g2 = np.minimum(g, np.maximum(r, b) + 10)
    rgba = np.dstack([r, np.where(alpha < 0.99, g2, g), b, alpha * 255]).clip(0, 255).astype(np.uint8)
    ys, xs = np.nonzero(keep)
    crop = Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    crop.thumbnail((width, width))
    crop.save(dst, "WEBP", quality=82)
    print(dst, crop.size)

def ladder(src, dst):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(float).mean(-1)
    w = a.shape[1]
    # the ladder is the bright band of columns in the middle
    cols = a.mean(0)
    mid = np.convolve(cols, np.ones(9) / 9, "same")
    centre = w // 2
    rows = a[:, int(w * 0.4):int(w * 0.6)].mean(1)
    rows = rows - rows.mean()
    ac = np.correlate(rows, rows, "full")[len(rows) - 1:]
    period = int(np.argmax(ac[60:400]) + 60)
    # rails: the strongest edges either side of the centre
    left = int(np.argmax(np.abs(np.diff(mid[:centre]))[int(w * 0.2):]) + int(w * 0.2))
    right = centre + int(np.argmax(np.abs(np.diff(mid[centre:]))[: int(w * 0.3)]))
    pad = int((right - left) * 0.12)
    top = a.shape[0] // 2 - (a.shape[0] // 2) % period
    tile = im.crop((left - pad, top, right + pad, top + period * 3))
    tile = tile.resize((96, round(96 * tile.height / tile.width)))
    tile.save(dst, "WEBP", quality=80)
    print(dst, tile.size, "period", period, "rails", left, right)

cut(gen, f"{out}/generator.webp", 700, 0.75, False)
cut(pur, f"{out}/purifier.webp", 520, 0.88, True)
ladder(lad, f"{out}/ladder.webp")
