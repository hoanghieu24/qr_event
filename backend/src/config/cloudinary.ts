import { v2 as cloudinary } from 'cloudinary';
import { ENV } from './env';

cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadImageToCloudinary(
  fileBase64OrPath: string,
  folder: string = 'event_posters'
): Promise<string> {
  const cleanInput = String(fileBase64OrPath || '').trim();
  if (!cleanInput) {
    return 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80';
  }

  if (/^https?:\/\//i.test(cleanInput)) {
    return cleanInput;
  }

  try {
    if (!ENV.CLOUDINARY_API_KEY || ENV.CLOUDINARY_API_KEY === '123456789') {
      // Store compressed Data URL directly when Cloudinary is not configured
      return cleanInput;
    }

    const result = await cloudinary.uploader.upload(cleanInput, {
      folder,
      resource_type: 'auto',
    });
    return result.secure_url;
  } catch (error) {
    console.error('[Cloudinary Upload Error - falling back to inline Data URL]', error);
    return cleanInput;
  }
}

export { cloudinary };
