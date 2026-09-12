export interface ICloudinaryOptimizedOptions {
  width?: number;
  height?: number;
  crop?: string;
  quality?: string | number;
}

export interface IUploadedFileResult {
  url: string;
  publicId: string;
  optimizedUrl?: string;
  resourceType?: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: Date;
}

