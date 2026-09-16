import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env.js";
cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    timeout: 120000,
});
export const deleteFromCloudinary = async (publicId, resourceType = "image") => {
    try {
        if (!publicId)
            return null;
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
        });
        return result;
    }
    catch (error) {
        console.error("Error deleting from Cloudinary:", error);
        throw error;
    }
};
export const getOptimizedUrl = (publicId, options = {}) => {
    if (!publicId)
        return null;
    return cloudinary.url(publicId, {
        secure: true,
        quality: "auto",
        fetch_format: "auto",
        ...options,
    });
};
export { cloudinary };
