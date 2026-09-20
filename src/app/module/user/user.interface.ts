import { Gender, UserRole } from "@prisma/client";

export interface IUserFilters {
  search?: string;
}

export interface IUpdateUserPayload {
  fullName?: string;
  username?: string;
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
  username: string;
  fullName: string;
  name: string;
  email: string;
  role: UserRole;
  gender?: Gender | null;
  dob?: Date | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  avatar?: string | null;
  profilePicUrl?: string | null;
  profilePicPublicId?: string | null;
  profilePicOptimizedUrl?: string | null;
  profilePicture?: {
    url: string | null;
    publicId?: string | null;
    optimizedUrl?: string | null;
  } | null;
  coverImage?: string | null;
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

// Step 1: refactor(user): add case-insensitive matching to getUserByUsername
// Step 2: refactor(user): add fallback ID lookup to getUserByUsername
// Step 3: refactor(user): add slugified fullName matching to getUserByUsername
// Step 4: refactor(user): enhance getUserById with fallback lookup by username
// Step 5: refactor(user): update searchUsers query to search username alongside fullName
// Step 6: feat(auth): implement auto-generation of unique username on manual signup
// Step 7: feat(auth): implement unique username generation on Google OAuth login
