import os
from collections import deque
from PIL import Image
import numpy as np

src_path = 'C:/Users/Nitro 5/.gemini/antigravity/brain/f9e1b140-6c67-4e43-a0d4-4a2955d94ee1/.user_uploaded/media_1794478514244_6f59cafa.jpg'
out_dir = 'C:/Users/Nitro 5/Desktop/qr_event/qr_event/frontend/public'
assets_dir = 'C:/Users/Nitro 5/Desktop/qr_event/qr_event/frontend/src/assets'
os.makedirs(out_dir, exist_ok=True)
os.makedirs(assets_dir, exist_ok=True)

img = Image.open(src_path).convert('RGB')
arr_orig = np.array(img).copy()
h, w, _ = arr_orig.shape

# Erase ".vn" suffix (starts at x=898 in source; x=897 is the gap after "o")
arr_orig[:, 897:, :] = 255
img_clean = Image.fromarray(arr_orig, mode='RGB')

# Bounding box of remaining foreground ([Icon] + EventGo)
gray = img_clean.convert('L')
arr_gray = np.array(gray)
mask_fg = arr_gray < 245
coords = np.argwhere(mask_fg)
y0, x0 = coords.min(axis=0)
y1, x1 = coords.max(axis=0)

pad = 12
x0_crop = max(0, x0 - pad)
y0_crop = max(0, y0 - pad)
x1_crop = min(w, x1 + pad + 1)
y1_crop = min(h, y1 + pad + 1)

# Coordinate dividers shifted into cropped coordinates
text_start_x = 360 - x0_crop
go_start_x = 707 - x0_crop

cropped_rgb = img_clean.crop((x0_crop, y0_crop, x1_crop, y1_crop))
for folder in (out_dir, assets_dir):
    cropped_rgb.save(os.path.join(folder, 'logo.png'), format='PNG', optimize=True)

# Helper: compute outer white background mask via flood fill from borders
cropped_rgba = cropped_rgb.convert('RGBA')
arr_rgba = np.array(cropped_rgba).copy()
ch, cw, _ = arr_rgba.shape

is_white = (arr_rgba[:, :, 0] > 238) & (arr_rgba[:, :, 1] > 238) & (arr_rgba[:, :, 2] > 238)
visited = np.zeros((ch, cw), dtype=bool)
queue = deque()

for x in range(cw):
    if is_white[0, x]:
        visited[0, x] = True
        queue.append((0, x))
    if is_white[ch - 1, x]:
        visited[ch - 1, x] = True
        queue.append((ch - 1, x))

for y in range(ch):
    if is_white[y, 0]:
        visited[y, 0] = True
        queue.append((y, 0))
    if is_white[y, cw - 1]:
        visited[y, cw - 1] = True
        queue.append((y, cw - 1))

while queue:
    y, x = queue.popleft()
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < ch and 0 <= nx < cw and not visited[ny, nx] and is_white[ny, nx]:
            visited[ny, nx] = True
            queue.append((ny, nx))

# 1) logo-transparent.png:
# - Outer background transparent
# - Inside text area (x >= text_start_x), enclosed white holes (e.g. inside 'e', 'o') also transparent
arr_trans = arr_rgba.copy()
arr_trans[visited, 3] = 0
for y in range(ch):
    for x in range(text_start_x, cw):
        r, g, b, _ = arr_trans[y, x]
        min_ch = int(min(r, g, b))
        if min_ch >= 242:
            arr_trans[y, x, 3] = 0
        elif min_ch > 210:
            alpha = int(round((242 - min_ch) / (242 - 210) * 255))
            arr_trans[y, x, 3] = min(arr_trans[y, x, 3], alpha)

trans_logo = Image.fromarray(arr_trans, mode='RGBA')
for folder in (out_dir, assets_dir):
    trans_logo.save(os.path.join(folder, 'logo-transparent.png'), format='PNG', optimize=True)

# 2) logo-white.png:
# - Keeps colorful calendar icon & bright blue/purple "Go"
# - Converts dark navy "Event" (text_start_x <= x < go_start_x) cleanly to smooth pure white (no dark fringe)
arr_white = arr_trans.copy()
for y in range(ch):
    for x in range(text_start_x, go_start_x):
        r, g, b, a = arr_white[y, x]
        if a == 0:
            continue
        min_ch = int(min(r, g, b))
        if min_ch >= 242:
            arr_white[y, x] = [255, 255, 255, 0]
        else:
            # Smooth anti-aliased alpha derived directly from ink darkness on white
            alpha_f = max(0.0, min(1.0, (242.0 - min_ch) / (242.0 - 35.0)))
            arr_white[y, x] = [255, 255, 255, int(round(alpha_f * 255))]

white_logo = Image.fromarray(arr_white, mode='RGBA')
for folder in (out_dir, assets_dir):
    white_logo.save(os.path.join(folder, 'logo-white.png'), format='PNG', optimize=True)

# 3) Square icon + favicons (icon part stays unchanged)
icon_x0 = max(0, x0 - pad)
icon_y0 = max(0, y0 - pad)
icon_x1 = min(w, 355 + pad)
icon_y1 = min(h, y1 + pad)

icon_crop = img_clean.crop((icon_x0, icon_y0, icon_x1, icon_y1))
iw, ih = icon_crop.size
max_side = max(iw, ih) + 20
square_icon = Image.new('RGB', (max_side, max_side), (255, 255, 255))
square_icon.paste(icon_crop, ((max_side - iw) // 2, (max_side - ih) // 2))

for size, names in (
    (512, ['icon-512.png']),
    (192, ['icon-192.png', 'icon.png']),
    (64, ['favicon.png']),
):
    resized = square_icon.resize((size, size), Image.Resampling.LANCZOS)
    for n in names:
        resized.save(os.path.join(out_dir, n), format='PNG')
        resized.save(os.path.join(assets_dir, n), format='PNG')

ico_img = square_icon.resize((32, 32), Image.Resampling.LANCZOS)
ico_img.save(os.path.join(out_dir, 'favicon.ico'), format='ICO')
ico_img.save(os.path.join(assets_dir, 'favicon.ico'), format='ICO')

print(f'Generated EventGo logos ({cw}x{ch}) and icons successfully!')
