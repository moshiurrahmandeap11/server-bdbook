import { Request } from "express";
import multer, { FileFilterCallback } from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinary } from "../lib/cloudinary";

const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedImageTypes.test(file.originalname.toLowerCase().split(".").pop() || "");
  const mimetype = allowedImageTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"));
  }
};

const postFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm|mpeg|3gp/;
  const extname = allowedTypes.test(file.originalname.toLowerCase().split(".").pop() || "");
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only images and videos are allowed!"));
  }
};

const profilePictureStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "bdbook/profiles",
    format: "jpg",
    public_id: `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    transformation: [{ width: 500, height: 500, crop: "limit", quality: "auto" }],
  }),
});

const coverPhotoStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "bdbook/covers",
    format: "jpg",
    public_id: `cover-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    transformation: [{ width: 1200, height: 400, crop: "fill", quality: "auto" }],
  }),
});

const postMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req: Request, file: Express.Multer.File) => {
    const isImage = file.mimetype.startsWith("image");
    const isVideo = file.mimetype.startsWith("video");

    const folder = "bdbook/posts";
    const resourceType = isVideo ? "video" : "image";
    const format = isImage ? "jpg" : "mp4";

    const transformation = isVideo
      ? [{ quality: "auto", bit_rate: "800k" }, { width: 1280, height: 720, crop: "limit" }]
      : [{ width: 1200, height: 1200, crop: "limit", quality: "auto" }];

    const eager = isVideo
      ? [{ width: 640, height: 480, crop: "fill", format: "jpg", start_offset: "2" }]
      : undefined;

    return {
      folder,
      resource_type: resourceType,
      format,
      public_id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      transformation,
      eager,
      timeout: 120000,
    };
  },
});

export const profilePictureUpload = multer({
  storage: profilePictureStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFileFilter,
});

export const coverPhotoUpload = multer({
  storage: coverPhotoStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFileFilter,
});

export const postUpload = multer({
  storage: postMediaStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for video
  fileFilter: postFileFilter,
});

export const messageMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

