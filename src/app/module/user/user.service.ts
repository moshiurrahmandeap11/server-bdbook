import { Prisma, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IPaginatedResult, IPaginationOptions } from "../../interfaces/common.interface";
import { deleteFromCloudinary, getOptimizedUrl } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import {
  IChangePasswordPayload,
  ICoverPhotoResponse,
  IProfilePicResponse,
  IUpdateUserPayload,
  IUserFilters,
  IUserProfileResponse,
} from "./user.interface";

const formatUserProfile = (user: User): IUserProfileResponse => {
  return {
    id: user.id,
    _id: user.id,
    username: user.username || user.email.split("@")[0],
    fullName: user.fullName,
    name: user.fullName,
    email: user.email,
    role: user.role,
    gender: user.gender,
    dob: user.dob,
    bio: user.bio,
    location: user.location,
    website: user.website,
    avatar: user.profilePicUrl,
    profilePicUrl: user.profilePicUrl,
    profilePicPublicId: user.profilePicPublicId,
    profilePicOptimizedUrl: user.profilePicOptimizedUrl,
    profilePicture: user.profilePicUrl
      ? {
          url: user.profilePicUrl,
          publicId: user.profilePicPublicId,
          optimizedUrl: user.profilePicOptimizedUrl,
        }
      : null,
    coverImage: user.coverPhotoUrl,
    coverPhotoUrl: user.coverPhotoUrl,
    coverPhotoPublicId: user.coverPhotoPublicId,
    coverPhotoOptimizedUrl: user.coverPhotoOptimizedUrl,
    coverPhoto: user.coverPhotoUrl
      ? {
          url: user.coverPhotoUrl,
          publicId: user.coverPhotoPublicId,
          optimizedUrl: user.coverPhotoOptimizedUrl,
        }
      : null,
    isVerified: user.isVerified,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const getMe = async (userId: string): Promise<IUserProfileResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  return formatUserProfile(user);
};

const getAllUsers = async (
  filters: IUserFilters,
  pagination: IPaginationOptions
): Promise<IPaginatedResult<IUserProfileResponse>> => {
  const page = Number(pagination.page) || 1;
  const limit = Number(pagination.limit) || 10;
  const skip = (page - 1) * limit;

  const whereClause: Prisma.UserWhereInput = {
    isActive: true,
  };

  if (filters.search) {
    whereClause.OR = [
      { fullName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where: whereClause }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: users.map(formatUserProfile),
  };
};

const getUserById = async (id: string): Promise<IUserProfileResponse> => {
  const cleanId = id.trim();
  let user = await prisma.user.findUnique({
    where: { id: cleanId },
  }).catch(() => null);

  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        username: {
          equals: cleanId.toLowerCase(),
          mode: "insensitive",
        },
      },
    });
  }

  if (!user) {
    const allUsers = await prisma.user.findMany();
    user =
      allUsers.find(
        (u) =>
          u.id === cleanId ||
          u.username?.toLowerCase() === cleanId.toLowerCase() ||
          u.fullName?.toLowerCase().replace(/\s+/g, "") === cleanId.toLowerCase()
      ) || null;
  }

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  return formatUserProfile(user);
};

const getUserByUsername = async (username: string): Promise<IUserProfileResponse> => {
  const cleanUsername = username.toLowerCase().trim();
  let user = await prisma.user.findFirst({
    where: {
      username: {
        equals: cleanUsername,
        mode: "insensitive",
      },
    },
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: { id: username.trim() },
    }).catch(() => null);
  }

  if (!user) {
    const allUsers = await prisma.user.findMany();
    user =
      allUsers.find(
        (u) =>
          u.username?.toLowerCase() === cleanUsername ||
          u.id === username.trim() ||
          u.fullName?.toLowerCase().replace(/\s+/g, "") === cleanUsername ||
          u.email?.split("@")[0].toLowerCase() === cleanUsername
      ) || null;
  }

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  return formatUserProfile(user);
};

const getUserByEmail = async (email: string): Promise<IUserProfileResponse> => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  return formatUserProfile(user);
};

const searchUsers = async (
  query: string,
  limit = 20
): Promise<IUserProfileResponse[]> => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { username: { contains: query.trim(), mode: "insensitive" } },
        { fullName: { contains: query.trim(), mode: "insensitive" } },
        { email: { contains: query.trim(), mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return users.map(formatUserProfile);
};

const updateUser = async (
  currentUserId: string,
  targetUserId: string,
  currentUserRole: string,
  payload: IUpdateUserPayload
): Promise<IUserProfileResponse> => {
  if (currentUserId !== targetUserId && currentUserRole !== "admin") {
    throw new AppError(status.FORBIDDEN, "You can only update your own profile");
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      fullName: payload.fullName?.trim() || undefined,
      gender: payload.gender || undefined,
      dob: payload.dob ? new Date(payload.dob) : undefined,
    },
  });

  return formatUserProfile(updatedUser);
};

const uploadProfilePicture = async (
  userId: string,
  file: Express.Multer.File
): Promise<IProfilePicResponse> => {
  if (!file) {
    throw new AppError(status.BAD_REQUEST, "No file uploaded");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  if (user.profilePicPublicId) {
    try {
      await deleteFromCloudinary(user.profilePicPublicId, "image");
    } catch {
      // Continue even if delete fails
    }
  }

  const url = file.path;
  const publicId = file.filename;
  const optimizedUrl = getOptimizedUrl(publicId, {
    width: 200,
    height: 200,
    crop: "fill",
  });

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      profilePicUrl: url,
      profilePicPublicId: publicId,
      profilePicOptimizedUrl: optimizedUrl,
    },
  });

  return {
    url: updatedUser.profilePicUrl!,
    publicId: updatedUser.profilePicPublicId!,
    optimizedUrl: updatedUser.profilePicOptimizedUrl,
    uploadedAt: updatedUser.updatedAt,
  };
};

const removeProfilePicture = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.profilePicPublicId) {
    throw new AppError(status.NOT_FOUND, "No profile picture found");
  }

  await deleteFromCloudinary(user.profilePicPublicId, "image");

  await prisma.user.update({
    where: { id: userId },
    data: {
      profilePicUrl: null,
      profilePicPublicId: null,
      profilePicOptimizedUrl: null,
    },
  });
};

const uploadCoverPhoto = async (
  userId: string,
  file: Express.Multer.File
): Promise<ICoverPhotoResponse> => {
  if (!file) {
    throw new AppError(status.BAD_REQUEST, "No file uploaded");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  if (user.coverPhotoPublicId) {
    try {
      await deleteFromCloudinary(user.coverPhotoPublicId, "image");
    } catch {
      // Continue even if delete fails
    }
  }

  const url = file.path;
  const publicId = file.filename;
  const optimizedUrl = getOptimizedUrl(publicId, {
    width: 1200,
    height: 400,
    crop: "fill",
  });

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      coverPhotoUrl: url,
      coverPhotoPublicId: publicId,
      coverPhotoOptimizedUrl: optimizedUrl,
    },
  });

  return {
    url: updatedUser.coverPhotoUrl!,
    publicId: updatedUser.coverPhotoPublicId!,
    optimizedUrl: updatedUser.coverPhotoOptimizedUrl,
    uploadedAt: updatedUser.updatedAt,
  };
};

const removeCoverPhoto = async (userId: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.coverPhotoPublicId) {
    throw new AppError(status.NOT_FOUND, "No cover photo found");
  }

  await deleteFromCloudinary(user.coverPhotoPublicId, "image");

  await prisma.user.update({
    where: { id: userId },
    data: {
      coverPhotoUrl: null,
      coverPhotoPublicId: null,
      coverPhotoOptimizedUrl: null,
    },
  });
};

const changePassword = async (
  userId: string,
  payload: IChangePasswordPayload
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  const isMatch = await bcrypt.compare(payload.currentPassword, user.password);
  if (!isMatch) {
    throw new AppError(status.UNAUTHORIZED, "Current password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(payload.newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
};

const deleteUser = async (
  currentUserId: string,
  targetUserId: string,
  currentUserRole: string
): Promise<void> => {
  if (currentUserId !== targetUserId && currentUserRole !== "admin") {
    throw new AppError(status.FORBIDDEN, "You can only delete your own account");
  }

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  if (user.profilePicPublicId) {
    try {
      await deleteFromCloudinary(user.profilePicPublicId, "image");
    } catch {
      // Continue
    }
  }

  if (user.coverPhotoPublicId) {
    try {
      await deleteFromCloudinary(user.coverPhotoPublicId, "image");
    } catch {
      // Continue
    }
  }

  await prisma.user.delete({
    where: { id: targetUserId },
  });
};

export const userService = {
  getMe,
  getAllUsers,
  getUserById,
  getUserByUsername,
  getUserByEmail,
  searchUsers,
  updateUser,
  uploadProfilePicture,
  removeProfilePicture,
  uploadCoverPhoto,
  removeCoverPhoto,
  changePassword,
  deleteUser,
};

