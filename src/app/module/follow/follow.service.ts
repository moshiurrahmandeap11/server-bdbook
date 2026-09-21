import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { notificationService } from "../notification/notification.service";
import {
  IFollowCountResponse,
  IFollowStatusResponse,
  IFollowUser,
} from "./follow.interface";

const followUser = async (
  followerId: string,
  followingId: string
): Promise<IFollowStatusResponse> => {
  if (followerId === followingId) {
    throw new AppError(status.BAD_REQUEST, "You cannot follow yourself");
  }

  const [follower, targetUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: followerId } }),
    prisma.user.findUnique({ where: { id: followingId } }),
  ]);

  if (!follower || !targetUser) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  // Create or keep existing follow
  await prisma.follow.upsert({
    where: {
      followerId_followingId: { followerId, followingId },
    },
    update: {},
    create: {
      followerId,
      followingId,
    },
  });

  // Trigger follow notification
  try {
    await notificationService.createNotification({
      userId: followingId,
      actorId: followerId,
      type: "follow",
      message: `${follower.fullName} started following you`,
    });
  } catch (err) {
    console.error("Failed to send follow notification:", err);
  }

  return { isFollowing: true };
};

const unfollowUser = async (
  followerId: string,
  followingId: string
): Promise<IFollowStatusResponse> => {
  await prisma.follow.deleteMany({
    where: {
      followerId,
      followingId,
    },
  });

  return { isFollowing: false };
};

const getFollowStatus = async (
  followerId: string,
  followingId: string
): Promise<IFollowStatusResponse> => {
  if (followerId === followingId) {
    return { isFollowing: false };
  }

  const follow = await prisma.follow.findFirst({
    where: {
      followerId,
      followingId,
    },
  });

  return { isFollowing: !!follow };
};

const getFollowers = async (userId: string): Promise<IFollowUser[]> => {
  const follows = await prisma.follow.findMany({
    where: { followingId: userId },
    include: {
      follower: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          profilePicUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return follows.map((f) => ({
    _id: f.follower.id,
    id: f.follower.id,
    fullName: f.follower.fullName,
    username: f.follower.username,
    email: f.follower.email,
    profilePicUrl: f.follower.profilePicUrl,
    profilePicture: {
      url: f.follower.profilePicUrl,
    },
    bio: f.follower.bio,
    followedAt: f.createdAt,
  }));
};

const getFollowersCount = async (
  userId: string
): Promise<IFollowCountResponse> => {
  const count = await prisma.follow.count({
    where: { followingId: userId },
  });
  return { count };
};

const getFollowing = async (userId: string): Promise<IFollowUser[]> => {
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    include: {
      following: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          profilePicUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return follows.map((f) => ({
    _id: f.following.id,
    id: f.following.id,
    fullName: f.following.fullName,
    username: f.following.username,
    email: f.following.email,
    profilePicUrl: f.following.profilePicUrl,
    profilePicture: {
      url: f.following.profilePicUrl,
    },
    bio: f.following.bio,
    followedAt: f.createdAt,
  }));
};

const getFollowingCount = async (
  userId: string
): Promise<IFollowCountResponse> => {
  const count = await prisma.follow.count({
    where: { followerId: userId },
  });
  return { count };
};

export const followService = {
  followUser,
  unfollowUser,
  getFollowStatus,
  getFollowers,
  getFollowersCount,
  getFollowing,
  getFollowingCount,
};

