import { Gender, UserRole } from "@prisma/client";

export interface IUserFilters {
  search?: string;
}

export interface IUpdateUserPayload {
  fullName?: string;
  gender?: Gender;
  dob?: string | Date;
  bio?: string;
  location?: string;
  website?: string;
}

export interface IChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface IUserProfileResponse {
  id: string;
  _id?: string;
  fullName: string;
  email: string;
  role: UserRole;
  gender?: Gender | null;
  dob?: Date | null;
  profilePicUrl?: string | null;
  profilePicPublicId?: string | null;
  profilePicOptimizedUrl?: string | null;
  profilePicture?: {
    url: string | null;
    publicId?: string | null;
    optimizedUrl?: string | null;
  } | null;
  coverPhotoUrl?: string | null;
  coverPhotoPublicId?: string | null;
  coverPhotoOptimizedUrl?: string | null;
  coverPhoto?: {
    url: string | null;
    publicId?: string | null;
    optimizedUrl?: string | null;
  } | null;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProfilePicResponse {
  url: string;
  publicId: string;
  optimizedUrl?: string | null;
  uploadedAt: Date;
}

export interface ICoverPhotoResponse {
  url: string;
  publicId: string;
  optimizedUrl?: string | null;
  uploadedAt: Date;
}

export interface ISearchUserParams {
  query: string;
  limit?: number;
}

