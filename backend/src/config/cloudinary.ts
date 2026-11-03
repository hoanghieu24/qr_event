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
  try {
    if (!ENV.CLOUDINARY_API_KEY || ENV.CLOUDINARY_API_KEY === '123456789') {
      // Mock / fallback if cloudinary not yet configured
      return `https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80`;
    }

    const result = await cloudinary.uploader.upload(fileBase64OrPath, {
      folder,
      resource_type: 'auto',
    });
    return result.secure_url;
  } catch (error) {
    console.error('[Cloudinary Upload Error]', error);
    throw new Error('Không thể tải ảnh lên Cloudinary');
  }
}

export { cloudinary };
