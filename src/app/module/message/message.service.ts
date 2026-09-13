import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import {
  IConversationItemResponse,
  IMessageItemResponse,
  ISendMessagePayload,
  IUnreadMessagesCountResponse,
  IUploadMediaResponse,
} from "./message.interface";

let emitMessageCallback: ((receiverId: string, message: unknown) => void) | null = null;

export const setMessageSocketEmitter = (
  callback: (receiverId: string, message: unknown) => void
) => {
  emitMessageCallback = callback;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatMessage = (msg: any): IMessageItemResponse => {
  return {
    _id: msg.id,
    id: msg.id,
    senderId: msg.senderId,
    senderName: msg.sender?.fullName || "User",
    senderProfilePicture: msg.sender?.profilePicUrl || null,
    receiverId: msg.receiverId,
    message: msg.message || "",
    messageType: msg.messageType,
    mediaUrl: msg.mediaUrl,
    fileName: msg.fileName,
    fileSize: msg.fileSize,
    isRead: msg.isRead,
    isDelivered: msg.isDelivered,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  };
};

const sendMessage = async (
  senderId: string,
  receiverId: string,
  payload: ISendMessagePayload
): Promise<IMessageItemResponse> => {
  const {
    message = "",
    messageType = "text",
    mediaUrl = null,
    fileName = null,
    fileSize = null,
    tempId,
  } = payload;

  const [sender, receiver] = await Promise.all([
    prisma.user.findUnique({ where: { id: senderId } }),
    prisma.user.findUnique({ where: { id: receiverId } }),
  ]);

  if (!sender || !receiver) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  // Format preview text
  const preview =
    messageType === "share"
      ? "📱 Shared a post"
      : message ||
        (messageType === "image"
          ? "📷 Photo"
          : messageType === "video"
          ? "📹 Video"
          : "📎 File");

  // Create message record
  const savedMessage = await prisma.message.create({
    data: {
      senderId,
      receiverId,
      message,
      messageType,
      mediaUrl,
      fileName,
      fileSize,
      isRead: false,
      isDelivered: true,
    },
    include: {
      sender: {
        select: {
          id: true,
          fullName: true,
          profilePicUrl: true,
        },
      },
    },
  });

  // Manage conversation record
  const existingConv = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: senderId } } },
        { participants: { some: { userId: receiverId } } },
      ],
    },
  });

  const now = new Date();

  if (existingConv) {
    await prisma.conversation.update({
      where: { id: existingConv.id },
      data: {
        lastMessage: preview,
        lastMessageTime: now,
      },
    });

    await prisma.message.update({
      where: { id: savedMessage.id },
      data: { conversationId: existingConv.id },
    });
  } else {
    await prisma.conversation.create({
      data: {
        lastMessage: preview,
        lastMessageTime: now,
        participants: {
          create: [{ userId: senderId }, { userId: receiverId }],
        },
        messages: {
          connect: { id: savedMessage.id },
        },
      },
    });
  }

  const formatted = {
    ...formatMessage(savedMessage),
    tempId: tempId || null,
  };

  // Socket notification
  if (emitMessageCallback) {
    try {
      emitMessageCallback(receiverId, formatted);
    } catch {
      // Non-blocking
    }
  }

  return formatted;
};

const getConversations = async (
  userId: string
): Promise<IConversationItemResponse[]> => {
  const friendships = await prisma.friendship.findMany({
    where: { userId },
    include: {
      friend: {
        select: {
          id: true,
          fullName: true,
          profilePicUrl: true,
        },
      },
    },
  });

  const conversations = await Promise.all(
    friendships.map(async (f) => {
      const lastMessage = await prisma.message.findFirst({
        where: {
          OR: [
            { senderId: userId, receiverId: f.friendId },
            { senderId: f.friendId, receiverId: userId },
          ],
        },
        orderBy: { createdAt: "desc" },
      });

      const unreadCount = await prisma.message.count({
        where: {
          senderId: f.friendId,
          receiverId: userId,
          isRead: false,
        },
      });

      return {
        friendId: f.friend.id,
        friendName: f.friend.fullName,
        friendProfilePicture: f.friend.profilePicUrl,
        lastMessage: lastMessage ? lastMessage.message || "Media" : null,
        unreadCount,
        updatedAt: lastMessage?.createdAt || f.createdAt,
      };
    })
  );

  conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return conversations;
};

const getMessages = async (
  userId: string,
  friendId: string
): Promise<IMessageItemResponse[]> => {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: friendId },
        { senderId: friendId, receiverId: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      sender: {
        select: {
          id: true,
          fullName: true,
          profilePicUrl: true,
        },
      },
    },
  });

  return messages.map(formatMessage);
};

const markAsRead = async (
  userId: string,
  senderId: string
): Promise<void> => {
  await prisma.message.updateMany({
    where: {
      senderId,
      receiverId: userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });
};

const getUnreadCount = async (
  userId: string
): Promise<IUnreadMessagesCountResponse> => {
  const count = await prisma.message.count({
    where: {
      receiverId: userId,
      isRead: false,
    },
  });

  return { count };
};

const uploadMessageMedia = async (
  file: Express.Multer.File
): Promise<IUploadMediaResponse> => {
  if (!file) {
    throw new AppError(status.BAD_REQUEST, "No file uploaded");
  }

  const base64 = file.buffer.toString("base64");
  const mimeType = file.mimetype;
  const fileType: "image" | "video" | "document" = mimeType.startsWith("image")
    ? "image"
    : mimeType.startsWith("video")
    ? "video"
    : "document";

  const mediaUrl = `data:${mimeType};base64,${base64}`;

  return {
    url: mediaUrl,
    type: fileType,
    name: file.originalname,
    size: file.size,
  };
};

export const messageService = {
  sendMessage,
  getConversations,
  getMessages,
  markAsRead,
  getUnreadCount,
  uploadMessageMedia,
};

