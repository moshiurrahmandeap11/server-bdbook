import { prisma } from "../../lib/prisma";

export const followUser = async (followerId: string, followingId: string) => {
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } }
  });
  if (existing) return existing;
  return prisma.follow.create({ data: { followerId, followingId } });
};

export const unfollowUser = async (followerId: string, followingId: string) => {
  return prisma.follow.deleteMany({ where: { followerId, followingId } });
};

export const getFollowStatus = async (currentUserId: string, targetUserId: string) => {
  const isFollowing = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: currentUserId, followingId: targetUserId } } });
  const isFollowedBy = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: targetUserId, followingId: currentUserId } } });
  return { isFollowing: !!isFollowing, isFollowedBy: !!isFollowedBy };
};

export const getFollowersCount = async (userId: string) => {
  return prisma.follow.count({ where: { followingId: userId } });
};
