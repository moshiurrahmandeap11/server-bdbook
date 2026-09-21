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
