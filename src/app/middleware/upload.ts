import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import fs from "fs";
import status from "http-status";
import * as mm from "music-metadata";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import sharp from "sharp";
import { env } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";

// Allowed MIME and extension checkers
const ALLOWED_IMAGE_EXTS = /jpeg|jpg|png|gif|webp|bmp|tiff|svg/;
const ALLOWED_VIDEO_EXTS = /mp4|mov|avi|mkv|webm|mpeg|3gp/;
const ALLOWED_DOC_EXTS = /pdf|doc|docx|txt|xls|xlsx|ppt|pptx/;

const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const ext = (file.originalname.toLowerCase().split(".").pop() || "").trim();
  const isImageMime = file.mimetype.startsWith("image/");
  const isImageExt = ALLOWED_IMAGE_EXTS.test(ext);

  if (isImageMime || isImageExt) {
    cb(null, true);
  } else {
    cb(new AppError(status.BAD_REQUEST, "Only image files (JPEG, PNG, WEBP, GIF) are allowed!"));
  }
};

const postFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const ext = (file.originalname.toLowerCase().split(".").pop() || "").trim();
  const isImage = file.mimetype.startsWith("image/") || ALLOWED_IMAGE_EXTS.test(ext);
  const isVideo = file.mimetype.startsWith("video/") || ALLOWED_VIDEO_EXTS.test(ext);
  const isDoc = file.mimetype.startsWith("application/") || ALLOWED_DOC_EXTS.test(ext);

  if (isImage || isVideo || isDoc) {
    cb(null, true);
  } else {
    cb(new AppError(status.BAD_REQUEST, "Only images, videos, and documents are allowed!"));
  }
};

// Memory storage for immediate streaming & Sharp compression
const memoryStorage = multer.memoryStorage();

const rawProfilePicUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB input limit
  fileFilter: imageFileFilter,
});

const rawCoverPhotoUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB input limit
  fileFilter: imageFileFilter,
});

const rawPostUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB input limit (for video)
  fileFilter: postFileFilter,
});

const rawMessageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: postFileFilter,
});

/**
 * Resolve the user's username for clean folder structure: uploads/{username}/{category}/
 */
export const resolveUsername = async (req: Request): Promise<string> => {
  const userId = req.user?.id;
  if (!userId) return "general";

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, fullName: true },
    });

    if (user?.username) {
      const clean = user.username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (clean) return clean;
    }
    if (user?.fullName) {
      const slug = user.fullName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (slug) return slug;
    }
    return userId;
  } catch {
    return userId;
  }
};

/**
 * Ensure user directory structure exists: uploads/{username}/{category}/
 */
export const ensureUserUploadDir = (
  username: string,
  category: "images" | "videos" | "docs"
): string => {
  const safeUsername = username.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase() || "general";
  const targetDir = path.join(env.UPLOAD_DIR, safeUsername, category);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
};

/**
 * Compress and optimize image to ensure it is max 400KB, converted to modern WebP.
 */
export const compressImageToMax400KB = async (
  buffer: Buffer,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    fit?: "contain" | "cover" | "fill" | "inside" | "outside";
  } = {}
): Promise<{ buffer: Buffer; format: string }> => {
  const { maxWidth = 1600, maxHeight, fit = "inside" } = options;
  const maxBytes = 400 * 1024; // 400 KB target

  let quality = 82;
  let currentWidth = maxWidth;
  let currentHeight = maxHeight;

  let outputBuffer = await sharp(buffer)
    .rotate()
    .resize({
      width: currentWidth,
      height: currentHeight,
      fit,
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer();

  // If still above 400KB, progressively step down quality and dimensions
  let attempts = 0;
  while (outputBuffer.length > maxBytes && attempts < 5 && quality > 35) {
    quality -= 12;
    currentWidth = Math.floor(currentWidth * 0.88);
    if (currentHeight) currentHeight = Math.floor(currentHeight * 0.88);

    outputBuffer = await sharp(buffer)
      .rotate()
      .resize({
        width: currentWidth,
        height: currentHeight,
        fit,
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer();

    attempts++;
  }

  return { buffer: outputBuffer, format: "webp" };
};

/**
 * Validate video duration (max 120 seconds = 2 minutes).
 */
export const checkVideoDuration = async (
  buffer: Buffer,
  mimetype: string,
  maxSeconds: number = 120
): Promise<number> => {
  try {
    const metadata = await mm.parseBuffer(buffer, { mimeType: mimetype });
    const duration = metadata.format.duration;
    if (typeof duration === "number" && duration > maxSeconds) {
      const minutes = Math.floor(duration / 60);
      const seconds = Math.round(duration % 60);
      throw new AppError(
        status.BAD_REQUEST,
        `Video duration exceeds maximum limit of 2 minutes (${minutes}m ${seconds}s uploaded, max 2 minutes allowed)`
      );
    }
    return duration || 0;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // If container format does not expose duration in header or is unreadable, log and allow
    console.warn("Could not read video duration metadata from buffer:", error);
    return 0;
  }
};

/**
 * Delete a media file from local uploads folder or gracefully ignore
 */
export const deleteLocalMedia = async (relativePathOrUrl?: string | null): Promise<void> => {
  if (!relativePathOrUrl) return;
  try {
    let relativePath = relativePathOrUrl;
    if (relativePathOrUrl.includes("/uploads/")) {
      relativePath = relativePathOrUrl.split("/uploads/")[1];
    }
    const fullPath = path.join(env.UPLOAD_DIR, relativePath);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  } catch (err) {
    console.warn("Failed to delete local media:", err);
  }
};

/**
 * Profile Picture Upload Middleware:
 * Saves to uploads/{username}/images/ with 500x500 crop and <= 400KB WebP
 */
export const profilePictureUpload = {
  single: (fieldName: string) => {
    const handler = rawProfilePicUpload.single(fieldName);
    return (req: Request, res: Response, next: NextFunction) => {
      handler(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file) return next();

        try {
          const username = await resolveUsername(req);
          const targetDir = ensureUserUploadDir(username, "images");

          const { buffer: compressedBuffer } = await compressImageToMax400KB(
            req.file.buffer,
            { maxWidth: 500, maxHeight: 500, fit: "cover" }
          );

          const uniqueId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
          const filename = `profile-${uniqueId}.webp`;
          const filePath = path.join(targetDir, filename);

          await fs.promises.writeFile(filePath, compressedBuffer);

          const relativePath = `${username}/images/${filename}`;
          req.file.path = `${env.SERVER_BASE_URL}/uploads/${relativePath}`;
          req.file.filename = relativePath;
          req.file.mimetype = "image/webp";
          req.file.size = compressedBuffer.length;

          next();
        } catch (processError) {
          next(processError);
        }
      });
    };
  },
};

/**
 * Cover Photo Upload Middleware:
 * Saves to uploads/{username}/images/ with 1200x400 fill and <= 400KB WebP
 */
export const coverPhotoUpload = {
  single: (fieldName: string) => {
    const handler = rawCoverPhotoUpload.single(fieldName);
    return (req: Request, res: Response, next: NextFunction) => {
      handler(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file) return next();

        try {
          const username = await resolveUsername(req);
          const targetDir = ensureUserUploadDir(username, "images");

          const { buffer: compressedBuffer } = await compressImageToMax400KB(
            req.file.buffer,
            { maxWidth: 1200, maxHeight: 400, fit: "cover" }
          );

          const uniqueId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
          const filename = `cover-${uniqueId}.webp`;
          const filePath = path.join(targetDir, filename);

          await fs.promises.writeFile(filePath, compressedBuffer);

          const relativePath = `${username}/images/${filename}`;
          req.file.path = `${env.SERVER_BASE_URL}/uploads/${relativePath}`;
          req.file.filename = relativePath;
          req.file.mimetype = "image/webp";
          req.file.size = compressedBuffer.length;

          next();
        } catch (processError) {
          next(processError);
        }
      });
    };
  },
};

/**
 * Post Media Upload Middleware:
 * Handles Images (WebP <= 400KB), Videos (<= 2 minutes limit), and Documents (<= 5MB)
 * Saves to uploads/{username}/{images|videos|docs}/
 */
export const postUpload = {
  single: (fieldName: string) => {
    const handler = rawPostUpload.single(fieldName);
    return (req: Request, res: Response, next: NextFunction) => {
      handler(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file) return next();

        try {
          const username = await resolveUsername(req);
          const ext = (req.file.originalname.toLowerCase().split(".").pop() || "").trim();
          const isVideo = req.file.mimetype.startsWith("video/") || ALLOWED_VIDEO_EXTS.test(ext);
          const isImage = req.file.mimetype.startsWith("image/") || ALLOWED_IMAGE_EXTS.test(ext);
          const isDoc = req.file.mimetype.startsWith("application/") || ALLOWED_DOC_EXTS.test(ext);

          const uniqueId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

          if (isImage) {
            const targetDir = ensureUserUploadDir(username, "images");
            const { buffer: compressedBuffer } = await compressImageToMax400KB(
              req.file.buffer,
              { maxWidth: 1600 }
            );

            const filename = `post-${uniqueId}.webp`;
            const filePath = path.join(targetDir, filename);
            await fs.promises.writeFile(filePath, compressedBuffer);

            const relativePath = `${username}/images/${filename}`;
            req.file.path = `${env.SERVER_BASE_URL}/uploads/${relativePath}`;
            req.file.filename = relativePath;
            req.file.mimetype = "image/webp";
            req.file.size = compressedBuffer.length;
          } else if (isVideo) {
            // Check max 2 minutes (120 seconds)
            await checkVideoDuration(req.file.buffer, req.file.mimetype, 120);

            const targetDir = ensureUserUploadDir(username, "videos");
            const videoExt = path.extname(req.file.originalname).toLowerCase() || ".mp4";
            const filename = `video-${uniqueId}${videoExt}`;
            const filePath = path.join(targetDir, filename);

            await fs.promises.writeFile(filePath, req.file.buffer);

            const relativePath = `${username}/videos/${filename}`;
            req.file.path = `${env.SERVER_BASE_URL}/uploads/${relativePath}`;
            req.file.filename = relativePath;
          } else if (isDoc) {
            if (req.file.size > 5 * 1024 * 1024) {
              throw new AppError(status.BAD_REQUEST, "Document file size exceeds 5MB limit");
            }

            const targetDir = ensureUserUploadDir(username, "docs");
            const docExt = path.extname(req.file.originalname).toLowerCase() || ".pdf";
            const filename = `doc-${uniqueId}${docExt}`;
            const filePath = path.join(targetDir, filename);

            await fs.promises.writeFile(filePath, req.file.buffer);

            const relativePath = `${username}/docs/${filename}`;
            req.file.path = `${env.SERVER_BASE_URL}/uploads/${relativePath}`;
            req.file.filename = relativePath;
          }

          next();
        } catch (processError) {
          next(processError);
        }
      });
    };
  },
};

/**
 * Message Media Upload Middleware:
 * Saves attached media to uploads/{username}/{category}/
 */
export const messageMediaUpload = {
  single: (fieldName: string) => {
    const handler = rawMessageUpload.single(fieldName);
    return (req: Request, res: Response, next: NextFunction) => {
      handler(req, res, async (err) => {
        if (err) return next(err);
        if (!req.file) return next();

        try {
          const username = await resolveUsername(req);
          const ext = (req.file.originalname.toLowerCase().split(".").pop() || "").trim();
          const isVideo = req.file.mimetype.startsWith("video/") || ALLOWED_VIDEO_EXTS.test(ext);
          const isImage = req.file.mimetype.startsWith("image/") || ALLOWED_IMAGE_EXTS.test(ext);

          const uniqueId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

          if (isImage) {
            const targetDir = ensureUserUploadDir(username, "images");
            const { buffer: compressedBuffer } = await compressImageToMax400KB(
              req.file.buffer,
              { maxWidth: 1200 }
            );

            const filename = `msg-${uniqueId}.webp`;
            const filePath = path.join(targetDir, filename);
            await fs.promises.writeFile(filePath, compressedBuffer);

            const relativePath = `${username}/images/${filename}`;
            req.file.path = `${env.SERVER_BASE_URL}/uploads/${relativePath}`;
            req.file.filename = relativePath;
            req.file.mimetype = "image/webp";
            req.file.size = compressedBuffer.length;
          } else if (isVideo) {
            await checkVideoDuration(req.file.buffer, req.file.mimetype, 120);

            const targetDir = ensureUserUploadDir(username, "videos");
            const videoExt = path.extname(req.file.originalname).toLowerCase() || ".mp4";
            const filename = `msg-video-${uniqueId}${videoExt}`;
            const filePath = path.join(targetDir, filename);

            await fs.promises.writeFile(filePath, req.file.buffer);

            const relativePath = `${username}/videos/${filename}`;
            req.file.path = `${env.SERVER_BASE_URL}/uploads/${relativePath}`;
            req.file.filename = relativePath;
          } else {
            if (req.file.size > 5 * 1024 * 1024) {
              throw new AppError(status.BAD_REQUEST, "Document file size exceeds 5MB limit");
            }

            const targetDir = ensureUserUploadDir(username, "docs");
            const docExt = path.extname(req.file.originalname).toLowerCase() || ".pdf";
            const filename = `msg-doc-${uniqueId}${docExt}`;
            const filePath = path.join(targetDir, filename);

            await fs.promises.writeFile(filePath, req.file.buffer);

            const relativePath = `${username}/docs/${filename}`;
            req.file.path = `${env.SERVER_BASE_URL}/uploads/${relativePath}`;
            req.file.filename = relativePath;
          }

          next();
        } catch (processError) {
          next(processError);
        }
      });
    };
  },
};
