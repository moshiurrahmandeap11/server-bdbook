// config/upload.js
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

dotenv.config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("Cloudinary configured with cloud name:", process.env.CLOUDINARY_CLOUD_NAME);

// File filter for profile/cover (images only)
const imageFileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedImageTypes.test(file.originalname.toLowerCase().split('.').pop());
  const mimetype = allowedImageTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// File filter for posts (images and videos)
const postFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm/;
  const extname = allowedTypes.test(file.originalname.toLowerCase().split('.').pop());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error('Only images and videos are allowed!'), false);
  }
};

// Configure storage for profile pictures
const profilePictureStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'bdbook/profiles',
    format: async (req, file) => 'jpg',
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `profile-${uniqueSuffix}`;
    },
    transformation: [{ width: 500, height: 500, crop: 'limit', quality: 'auto' }]
  },
});

// Configure storage for cover photos
const coverPhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'bdbook/covers',
    format: async (req, file) => 'jpg',
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return `cover-${uniqueSuffix}`;
    },
    transformation: [{ width: 1200, height: 400, crop: 'fill', quality: 'auto' }]
  },
});

// Configure storage for post media - FIXED VERSION
const postMediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const isImage = file.mimetype.startsWith('image');
    const isVideo = file.mimetype.startsWith('video');
    
    let folder = 'bdbook/posts';
    let resourceType = 'auto';
    let format = isImage ? 'jpg' : 'mp4'; // Specify actual format instead of 'auto'
    
    if (isImage) {
      resourceType = 'image';
      format = 'jpg';
    } else if (isVideo) {
      resourceType = 'video';
      format = 'mp4';
    }
    
    return {
      folder: folder,
      resource_type: resourceType,
      format: format, // Use specific format instead of 'auto'
      public_id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
    };
  },
});

// Create multer instances
const profilePictureUpload = multer({
  storage: profilePictureStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const coverPhotoUpload = multer({
  storage: coverPhotoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const postUpload = multer({
  storage: postMediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: postFileFilter,
});

// Helper functions
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    if (!publicId) return null;
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    console.log('Deleted from Cloudinary:', publicId, result);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

const getOptimizedUrl = (publicId, options = {}) => {
  if (!publicId) return null;
  return cloudinary.url(publicId, {
    secure: true,
    quality: 'auto',
    fetch_format: 'auto',
    ...options,
  });
};

// Export all
export {
  cloudinary,
  coverPhotoUpload,
  deleteFromCloudinary,
  getOptimizedUrl, postUpload, profilePictureUpload
};
