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
w, h = img.size

# Find bounding box of foreground (anything not near pure white)
gray = img.convert('L')
arr = np.array(gray)
mask_fg = arr < 250
coords = np.argwhere(mask_fg)
y0, x0 = coords.min(axis=0)
y1, x1 = coords.max(axis=0)

pad = 12
x0_crop = max(0, x0 - pad)
y0_crop = max(0, y0 - pad)
x1_crop = min(w, x1 + pad)
y1_crop = min(h, y1 + pad)

cropped_rgb = img.crop((x0_crop, y0_crop, x1_crop, y1_crop))
cropped_rgb.save(os.path.join(out_dir, 'logo.png'), format='PNG', optimize=True)
cropped_rgb.save(os.path.join(assets_dir, 'logo.png'), format='PNG', optimize=True)

# Generate transparent logo:
# We do a BFS / flood-fill from all 4 borders for pixels that are nearly white (R>242, G>242, B>242)
cropped_rgba = cropped_rgb.convert('RGBA')
arr_rgba = np.array(cropped_rgba)
cw, ch = cropped_rgb.size

is_white = (arr_rgba[:, :, 0] > 240) & (arr_rgba[:, :, 1] > 240) & (arr_rgba[:, :, 2] > 240)
visited = np.zeros((ch, cw), dtype=bool)
queue = deque()

# Add all border pixels that are white to queue
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
        if 0 <= ny < ch and 0 <= nx < cw:
            if not visited[ny, nx] and is_white[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

# Set alpha to 0 for all outer visited white pixels
arr_rgba[visited, 3] = 0

# Feather edges slightly for anti-aliasing
for y, x in np.argwhere(visited):
    # If adjacent to non-visited, we could leave slight alpha or clean
    pass

trans_logo = Image.fromarray(arr_rgba, mode='RGBA')
trans_logo.save(os.path.join(out_dir, 'logo-transparent.png'), format='PNG', optimize=True)
trans_logo.save(os.path.join(assets_dir, 'logo-transparent.png'), format='PNG', optimize=True)

# Generate icon square:
# Icon coordinates in the original image:
icon_x0 = max(0, x0 - pad)
icon_y0 = max(0, y0 - pad)
icon_x1 = min(w, 355 + pad)
icon_y1 = min(h, y1 + pad)

icon_crop = img.crop((icon_x0, icon_y0, icon_x1, icon_y1))
# Make it square with padding
iw, ih = icon_crop.size
max_side = max(iw, ih) + 20
square_icon = Image.new('RGB', (max_side, max_side), (255, 255, 255))
offset_x = (max_side - iw) // 2
offset_y = (max_side - ih) // 2
square_icon.paste(icon_crop, (offset_x, offset_y))

square_icon.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(out_dir, 'icon-512.png'), format='PNG')
square_icon.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(out_dir, 'icon-192.png'), format='PNG')
square_icon.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(out_dir, 'favicon.png'), format='PNG')
square_icon.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(out_dir, 'favicon.ico'), format='ICO')

print('Generated logo and icons successfully!')
