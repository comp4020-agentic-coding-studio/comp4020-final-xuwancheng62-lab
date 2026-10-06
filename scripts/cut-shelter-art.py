# Cuts the generated shelter art out of its flat background (green, or
# magenta for plants), crops the ladder to a whole number of rungs so it
# tiles, and mirrors the textures so they tile without seams. Run once with
# Pillow, numpy and scipy (a throwaway venv; not a dependency of the app):
#   python cut-shelter-art.py <dir of generated pngs> <out dir>
import glob
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1:3]
latest = lambda name: sorted(glob.glob(f"{src}/{name}-m*.png"))[-1]

# name: (output width, rows from which a pale floor is dropped, also drop a cool shadow there, keep only the biggest piece)
CUTS = {
    "generator": (700, 0.75, False, False),
    "purifier": (520, 0.88, True, False),
    "shelf": (320, 0.9, False, False),
    "crate": (300, None, False, True),
    "scrap-1": (100, None, False, True),
    "scrap-2": (100, None, False, True),
    "scrap-3": (100, None, False, True),
    "bed": (480, None, False, False),
    "planter": (380, None, False, True),
    "growlamp": (80, None, False, True),
    "sprout": (160, None, False, True),
    "potatoes-growing": (200, None, False, True),
    "potatoes-ready": (200, None, False, False),
    "beans-growing": (200, None, False, True),
    "beans-ready": (200, None, False, True),
    "mushrooms-growing": (200, None, False, False),
    "mushrooms-ready": (200, None, False, False),
    "hatch-shut": (200, None, False, True),
    "hatch-up": (200, None, False, True),
    "can-1": (80, None, False, True),
    "can-2": (80, None, False, True),
    "can-3": (80, None, False, True),
    "jug-1": (80, None, False, True),
    "jug-2": (80, None, False, True),
    "beast": (320, None, False, True),
}

# stock on the shelves is toned down to sit in the room's dim, warm light
MUTE = {"can-1", "can-2", "can-3", "jug-1", "jug-2"}

WOOD = {"planter", "crate"}

# a tin is a cylinder: where the key bit into its highlight or a label of
# nearly the background's colour, its straight sides are put back
TIN = {"can-1", "can-2", "can-3"}
# the gap under a jug's handle is background, not pale plastic
OPEN = {"jug-1", "jug-2"}


def cut(name, width, floor_from, shadow, biggest):
    im = np.asarray(Image.open(latest(name)).convert("RGB")).astype(float)
    bg = np.median(np.concatenate([im[:8].reshape(-1, 3), im[:, :8].reshape(-1, 3), im[:, -8:].reshape(-1, 3)]), axis=0)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    dist = np.sqrt(((im - bg) ** 2).sum(-1))
    bright = (r + g + b) / 3
    if bg[1] > bg[0] + 20 and bg[1] > bg[2] + 20:
        # green: as bright as the background (an olive body is darker and stays),
        # or far greener than anything painted (its shadow)
        backdrop = (g > 1.45 * np.maximum(r, b) + 8)
        if name not in MUTE:  # on shiny stock the green reflects into the metal; leave that to the distance test
            backdrop |= (g > r + 25) & (g > b + 25) & (bright > bg.mean() * 0.9)
        # along the object's base, where its shadow fades out, any green tint at all
        ys = np.nonzero(((dist > 60) & ~backdrop).any(1))[0]
        foot = np.zeros_like(backdrop)
        foot[ys[0] + int((ys[-1] - ys[0]) * 0.75):] = True
        backdrop |= foot & (g > np.maximum(r, b) + 6)
    elif bg[0] > bg[1] + 30 and bg[2] > bg[1] + 20:
        # magenta, its shadows included: no plant is that colour
        backdrop = ((r > g + 35) & (b > g + 25)) | ((r > g + 15) & (b > g + 5) & (bright < 120))
        if name.startswith("hatch"):
            # grime painted on the ground around the rim: grey mixed into the magenta
            backdrop |= (r > g + 10) & (b > g - 2)
    else:
        backdrop = np.zeros_like(dist, dtype=bool)
    if name in WOOD:
        # bare wood is never greener than it is red
        backdrop |= g > r + 4
    keep = (dist > 60) & ~backdrop
    if floor_from is not None:
        # the floor line and cast shadow along the bottom: pale, or cooler than the rusty metal
        low = np.zeros_like(keep)
        low[int(len(keep) * floor_from):] = True
        keep &= ~(low & ((bright > 165) | (shadow & (b > r + 5))))
    keep = ndimage.binary_opening(keep, iterations=2)
    labels, n = ndimage.label(keep)
    sizes = ndimage.sum(keep, labels, range(1, n + 1))
    keep = np.isin(labels, 1 + (np.array([np.argmax(sizes)]) if biggest else np.flatnonzero(sizes > sizes.max() * 0.02)))
    # enclosed patches are the object's own pale paint, unless they really are the background showing through
    holes = ndimage.binary_fill_holes(keep) & ~keep
    if name in OPEN:
        hl, hn = ndimage.label(holes)
        hs = ndimage.sum(holes, hl, range(1, hn + 1))
        holes = np.isin(hl, 1 + np.flatnonzero(hs < keep.sum() * 0.004))
    keep |= holes & (dist > 40) & ~backdrop
    if name in TIN:
        rows = np.nonzero(keep.any(1))[0]
        lo = np.array([np.argmax(keep[y]) for y in rows])
        hi = np.array([keep.shape[1] - np.argmax(keep[y][::-1]) for y in rows])
        n_ = len(rows)
        body = slice(int(n_ * 0.1), int(n_ * 0.9))
        left, right = np.percentile(lo[body], 5), np.percentile(hi[body], 95)
        for i, y in enumerate(rows):
            # the rims' rounded ends keep their own outline
            a, b_ = (lo[i], hi[i]) if not (n_ * 0.04 < i < n_ * 0.96) else (min(lo[i], left), max(hi[i], right))
            keep[y, int(a):int(b_)] = True
    else:
        # a pixel of edge hidden under the anti-aliasing, so no fringe of the key shows
        keep = ndimage.binary_erosion(keep)
    alpha = ndimage.gaussian_filter(keep.astype(float), 0.8)
    # pull leftover background colour out of the edges
    edge = alpha < 0.99
    if bg[1] > bg[0]:
        g = np.where(edge, np.minimum(g, np.maximum(r, b) + 10), g)
    else:
        r = np.where(edge, np.minimum(r, g + 12), r)
        b = np.where(edge, np.minimum(b, g + 12), b)
    if name in MUTE:
        grey = 0.3 * r + 0.59 * g + 0.11 * b
        r, g, b = [grey + (ch - grey) * 0.62 for ch in (r, g, b)]
    rgba = np.dstack([r, g, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    ys, xs = np.nonzero(keep)
    crop = Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    crop.thumbnail((width, width * 3))
    crop.save(f"{out}/{name}.webp", "WEBP", quality=82)
    print(name, crop.size)


def ladder(name):
    im = Image.open(latest(name)).convert("RGB")
    a = np.asarray(im).astype(float).mean(-1)
    w = a.shape[1]
    # the ladder is the bright band of columns in the middle
    mid = np.convolve(a.mean(0), np.ones(9) / 9, "same")
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
    tile.save(f"{out}/{name}.webp", "WEBP", quality=80)
    print(name, tile.size, "period", period, "rails", left, right)


def texture(name, size=256):
    # the middle of the picture, mirrored both ways, tiles without a seam
    im = Image.open(latest(name)).convert("RGB")
    s = min(im.size) // 2
    c = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2))
    tile = Image.new("RGB", (s * 2, s * 2))
    tile.paste(c, (0, 0))
    tile.paste(c.transpose(Image.FLIP_LEFT_RIGHT), (s, 0))
    tile.paste(c.transpose(Image.FLIP_TOP_BOTTOM), (0, s))
    tile.paste(c.transpose(Image.ROTATE_180), (s, s))
    tile.resize((size, size)).save(f"{out}/{name}.jpg", "JPEG", quality=78)
    print(name, size)


names = sys.argv[3:] or [*CUTS, "ladder", "earth", "concrete"]
for name in names:
    if name in CUTS:
        cut(name, *CUTS[name])
    elif name == "ladder":
        ladder(name)
    else:
        texture(name)
