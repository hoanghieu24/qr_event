import os
from PIL import Image
import numpy as np

out_dir = 'C:/Users/Nitro 5/Desktop/qr_event/qr_event/frontend/public'
assets_dir = 'C:/Users/Nitro 5/Desktop/qr_event/qr_event/frontend/src/assets'

trans_logo = Image.open(os.path.join(out_dir, 'logo-transparent.png')).convert('RGBA')
arr = np.array(trans_logo)

# Find dark navy pixels in the text portion (x > 350, alpha > 100, and R < 60, G < 60, B < 120)
# Make them clean crisp white (255, 255, 255)
h, w, _ = arr.shape
for y in range(h):
    for x in range(350, w):
        r, g, b, a = arr[y, x]
        if a > 80:
            # Check if this is dark text ("Event" and ".vn")
            # Dark navy text has low brightness and low red/green
            if r < 75 and g < 75 and b < 125:
                arr[y, x, 0] = 255
                arr[y, x, 1] = 255
                arr[y, x, 2] = 255

white_text_logo = Image.fromarray(arr, mode='RGBA')
white_text_logo.save(os.path.join(out_dir, 'logo-white.png'), format='PNG', optimize=True)
white_text_logo.save(os.path.join(assets_dir, 'logo-white.png'), format='PNG', optimize=True)
print('Generated logo-white.png successfully!')
