# Cuts a generated character figure out of its flat green background for the
# shelter scene: keys out the green, drops the painted ground shadow under
# the boots, keeps the one figure, trims it, and scales it to a fixed height.
# Run with Pillow, numpy and scipy in a throwaway venv (not an app dependency):
#   python cut-character-sprites.py <generated png> <out webp> [height]
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1:3]
height = int(sys.argv[3]) if len(sys.argv) > 3 else 320

im = np.asarray(Image.open(src).convert("RGB")).astype(float)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
# the background: green clearly ahead of red and blue
bg_green = (g - np.maximum(r, b) > 28) & (g > 90)
# soft green edges (anti-aliasing and spill) become partly transparent
spill = np.clip((g - np.maximum(r, b) - 6) / 22, 0, 1)
alpha = 1 - spill
alpha[bg_green] = 0

# the ground shadow: a wide low patch the boots stand in. Above it the figure
# is narrow (legs and boots); find the boots' columns just above the shadow
# and, below that, keep only those columns, widened a little for the soles.
h, w = alpha.shape
solid = alpha > 0.5
widths = solid.sum(axis=1)
rows = np.where(widths > 0)[0]
top, bottom = rows.min(), rows.max()
legs = np.median(widths[top + 3 * (bottom - top) // 4: top + 9 * (bottom - top) // 10])
spread = next((y for y in range(top + 9 * (bottom - top) // 10, bottom + 1) if widths[y] > 1.6 * legs), None)
if spread is not None:
    above = solid[spread - 12: spread - 2].any(axis=0)
    cols = ndimage.binary_dilation(above, iterations=w // 60)
    alpha[spread:, ~cols] = 0
    # the shadow also sits between the boots: drop dull ground-coloured pixels there
    low = im[spread:]
    ground = (np.abs(low[..., 0] - 140) < 30) & (np.abs(low[..., 1] - 130) < 30) & (np.abs(low[..., 2] - 95) < 30)
    alpha[spread:][ground] = 0

# keep only the biggest connected piece: the person
labels, n = ndimage.label(alpha > 0.3)
if n > 1:
    sizes = ndimage.sum(np.ones_like(alpha), labels, range(1, n + 1))
    keep = labels == (1 + int(np.argmax(sizes)))
    keep = ndimage.binary_dilation(keep, iterations=2)
    alpha[~keep] = 0

# take the green tint off the soft edge pixels
edge = (alpha > 0) & (alpha < 1)
im[..., 1][edge] = np.minimum(im[..., 1][edge], np.maximum(im[..., 0][edge], im[..., 2][edge]) + 8)

ys, xs = np.where(alpha > 0.05)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
rgba = np.dstack([im, alpha * 255]).astype(np.uint8)[y0:y1, x0:x1]
fig = Image.fromarray(rgba, "RGBA")
fig = fig.resize((round(fig.width * height / fig.height), height), Image.LANCZOS)
fig.save(out, "WEBP", quality=88, method=6)
print(f"{out}: {fig.width}x{fig.height}")
