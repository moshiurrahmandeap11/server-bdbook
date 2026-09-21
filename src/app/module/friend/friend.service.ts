import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { notificationService } from "../notification/notification.service";
import {
  IFollowerItemResponse,
  IFriendCountResponse,
  IFriendItemResponse,
  IFriendRequestItemResponse,
  IFriendStatusResponse,
} from "./friend.interface";

const sendFriendRequest = async (
  senderId: string,
  receiverId: string
): Promise<void> => {
  if (senderId === receiverId) {
    throw new AppError(status.BAD_REQUEST, "You cannot send a friend request to yourself");
  }

  const [sender, receiver] = await Promise.all([
    prisma.user.findUnique({ where: { id: senderId } }),
    prisma.user.findUnique({ where: { id: receiverId } }),
  ]);

  if (!sender || !receiver) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  const existingFriend = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: senderId, friendId: receiverId },
        { userId: receiverId, friendId: senderId },
      ],
    },
  });

  if (existingFriend) {
    throw new AppError(status.BAD_REQUEST, "Already friends");
  }

  const existingRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId, receiverId, status: "pending" },
        { senderId: receiverId, receiverId: senderId, status: "pending" },
      ],
    },
  });

  if (existingRequest) {
    throw new AppError(status.BAD_REQUEST, "Friend request already sent");
  }

  const request = await prisma.friendRequest.upsert({
    where: {
      senderId_receiverId: { senderId, receiverId },
    },
    update: {
      status: "pending",
    },
    create: {
      senderId,
      receiverId,
      status: "pending",
    },
  });

  await notificationService.createNotification({
    userId: receiverId,
    actorId: senderId,
    type: "friend_request",
    requestId: request.id,
    message: `${sender.fullName} sent you a friend request`,
  });
};

const acceptFriendRequest = async (
  userId: string,
  requestId: string
): Promise<void> => {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
    include: { receiver: true, sender: true },
  });

  if (!request || request.receiverId !== userId || request.status !== "pending") {
    throw new AppError(status.NOT_FOUND, "Friend request not found");
  }

  await prisma.$transaction([
    prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: "accepted" },
    }),
    prisma.friendship.upsert({
      where: {
        userId_friendId: { userId: request.senderId, friendId: request.receiverId },
      },
      update: {},
      create: { userId: request.senderId, friendId: request.receiverId },
    }),
    prisma.friendship.upsert({
      where: {
        userId_friendId: { userId: request.receiverId, friendId: request.senderId },
      },
      update: {},
      create: { userId: request.receiverId, friendId: request.senderId },
    }),
  ]);

  await notificationService.createNotification({
    userId: request.senderId,
    actorId: userId,
    type: "friend_accept",
    message: `${request.receiver.fullName} accepted your friend request`,
  });
};

const declineFriendRequest = async (
  userId: string,
  requestId: string
): Promise<void> => {
  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || request.receiverId !== userId || request.status !== "pending") {
    throw new AppError(status.NOT_FOUND, "Friend request not found");
  }

  await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: "declined" },
  });
};

const getFriendRequests = async (
  userId: string
): Promise<IFriendRequestItemResponse[]> => {
  const requests = await prisma.friendRequest.findMany({
    where: { receiverId: userId, status: "pending" },
    include: {
      sender: {
        select: {
          id: true,
          fullName: true,
          profilePicUrl: true,
        },
      },
      receiver: {
        select: {
          id: true,
          fullName: true,
          profilePicUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    _id: r.id,
    id: r.id,
    senderId: r.senderId,
    senderName: r.sender.fullName,
    senderProfilePicture: r.sender.profilePicUrl,
    receiverId: r.receiverId,
    receiverName: r.receiver.fullName,
    receiverProfilePicture: r.receiver.profilePicUrl,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
};

const getFriends = async (userId: string): Promise<IFriendItemResponse[]> => {
  const friendships = await prisma.friendship.findMany({
    where: { userId },
    include: {
      friend: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePicUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return friendships.map((f) => ({
    _id: f.friend.id,
    id: f.friend.id,
    fullName: f.friend.fullName,
    email: f.friend.email,
    profilePicture: {
      url: f.friend.profilePicUrl,
    },
    friendSince: f.createdAt,
  }));
};

const getUserFriends = async (userId: string): Promise<IFriendItemResponse[]> => {
  return getFriends(userId);
};

const getFriendsCount = async (
  userId: string
): Promise<IFriendCountResponse> => {
  const count = await prisma.friendship.count({
    where: { userId },
  });
  return { count };
};

const getFollowers = async (
  userId: string
): Promise<IFollowerItemResponse[]> => {
  const requests = await prisma.friendRequest.findMany({
    where: { receiverId: userId },
    include: {
      sender: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePicUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    _id: r.sender.id,
    id: r.sender.id,
    fullName: r.sender.fullName,
    profilePicture: {
      url: r.sender.profilePicUrl,
    },
    email: r.sender.email,
    status: r.status,
    requestId: r.id,
    requestedAt: r.createdAt,
  }));
};

const getFollowersCount = async (
  userId: string
): Promise<IFriendCountResponse> => {
  const count = await prisma.friendRequest.count({
    where: { receiverId: userId, status: "pending" },
  });
  return { count };
};

const getFollowing = async (
  userId: string
): Promise<IFollowerItemResponse[]> => {
  const requests = await prisma.friendRequest.findMany({
    where: { senderId: userId },
    include: {
      receiver: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePicUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    _id: r.receiver.id,
    id: r.receiver.id,
    fullName: r.receiver.fullName,
    profilePicture: {
      url: r.receiver.profilePicUrl,
    },
    email: r.receiver.email,
    status: r.status,
    requestId: r.id,
    requestedAt: r.createdAt,
  }));
};

const getFollowingCount = async (
  userId: string
): Promise<IFriendCountResponse> => {
  const count = await prisma.friendRequest.count({
    where: { senderId: userId, status: "pending" },
  });
  return { count };
};

const getFriendStatus = async (
  currentUserId: string,
  targetUserId: string
): Promise<IFriendStatusResponse> => {
  if (currentUserId === targetUserId) {
    return { status: "self" };
  }

  const isFriend = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId: currentUserId, friendId: targetUserId },
        { userId: targetUserId, friendId: currentUserId },
      ],
    },
  });

  if (isFriend) {
    return { status: "friends" };
  }

  const sentRequest = await prisma.friendRequest.findFirst({
    where: {
      senderId: currentUserId,
      receiverId: targetUserId,
      status: "pending",
    },
  });

  if (sentRequest) {
    return { status: "request_sent" };
  }

  const receivedRequest = await prisma.friendRequest.findFirst({
    where: {
      senderId: targetUserId,
      receiverId: currentUserId,
      status: "pending",
    },
  });

  if (receivedRequest) {
    return { status: "request_received" };
  }

  return { status: "not_friends" };
};

const removeFriend = async (
  userId: string,
  friendId: string
): Promise<void> => {
  await Promise.all([
    prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    }),
    prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
    }),
  ]);
};

const getSavedPosts = async (userId: string) => {
  const saved = await prisma.savedPost.findMany({
    where: { userId },
    include: {
      post: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profilePicUrl: true,
            },
          },
          likes: true,
          comments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return saved.map((s) => ({
    _id: s.post.id,
    id: s.post.id,
    userId: s.post.userId,
    userName: s.post.user.fullName,
    userEmail: s.post.user.email,
    userProfilePicture: s.post.user.profilePicUrl,
    description: s.post.description,
    media: s.post.mediaUrl
      ? {
          url: s.post.mediaUrl,
          publicId: s.post.mediaPublicId,
          resourceType: s.post.mediaType,
          mimeType: s.post.mediaMimeType,
          size: s.post.mediaSize,
          uploadedAt: s.post.createdAt,
        }
      : null,
    likes: s.post.likes.map((l) => l.userId),
    likesCount: s.post.likes.length,
    commentsCount: s.post.comments.length,
    createdAt: s.post.createdAt,
    updatedAt: s.post.updatedAt,
    isActive: s.post.isActive,
  }));
};

export const friendService = {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriendRequests,
  getFriends,
  getUserFriends,
  getFriendsCount,
  getFollowers,
  getFollowersCount,
  getFollowing,
  getFollowingCount,
  getFriendStatus,
  removeFriend,
  getSavedPosts,
};

