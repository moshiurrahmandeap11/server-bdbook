import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import {
  IConversationItemResponse,
  ICreateGroupPayload,
  IMessageItemResponse,
  IMessageReactionItem,
  ISendMessagePayload,
  IUnreadMessagesCountResponse,
  IUploadMediaResponse,
} from "./message.interface";

let emitMessageCallback: ((receiverId: string, message: unknown) => void) | null = null;
let emitGroupMessageCallback:
  | ((userIds: string[], message: unknown) => void)
  | null = null;
let emitReactionCallback:
  | ((userIds: string[], data: { messageId: string; reactions: IMessageReactionItem[] }) => void)
  | null = null;

export const setMessageSocketEmitter = (
  callback: (receiverId: string, message: unknown) => void
) => {
  emitMessageCallback = callback;
};

export const setGroupMessageSocketEmitter = (
  callback: (userIds: string[], message: unknown) => void
) => {
  emitGroupMessageCallback = callback;
};

export const setMessageReactionSocketEmitter = (
  callback: (
    userIds: string[],
    data: { messageId: string; reactions: IMessageReactionItem[] }
  ) => void
) => {
  emitReactionCallback = callback;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatMessage = (msg: any): IMessageItemResponse => {
  return {
    _id: msg.id,
    id: msg.id,
    conversationId: msg.conversationId || null,
    senderId: msg.senderId,
    senderName: msg.sender?.fullName || "User",
    senderProfilePicture: msg.sender?.profilePicUrl || null,
    receiverId: msg.receiverId || null,
    message: msg.message || "",
    messageType: msg.messageType,
    mediaUrl: msg.mediaUrl,
    fileName: msg.fileName,
    fileSize: msg.fileSize,
    callDuration: msg.callDuration ?? null,
    isRead: msg.isRead,
    isDelivered: msg.isDelivered,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
    reactions: (msg.reactions || []).map((r: any) => ({
      id: r.id,
      messageId: r.messageId,
      userId: r.userId,
      userName: r.user?.fullName || "User",
      userAvatar: r.user?.profilePicUrl || null,
      reaction: r.reaction,
      createdAt: r.createdAt,
    })),
  };
};

const sendMessage = async (
  senderId: string,
  receiverOrConvId: string,
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

  const sender = await prisma.user.findUnique({ where: { id: senderId } });
  if (!sender) {
    throw new AppError(status.NOT_FOUND, "Sender not found");
  }

  // Format preview text
  const preview =
    messageType === "share"
      ? "📱 Shared a post"
      : messageType === "audio_call"
      ? "📞 Audio Call"
      : messageType === "video_call"
      ? "🎥 Video Call"
      : messageType === "missed_call"
      ? "📞 Missed Call"
      : message ||
        (messageType === "image"
          ? "📷 Photo"
          : messageType === "video"
          ? "📹 Video"
          : "📎 File");

  const now = new Date();

  // 1. Check if receiverOrConvId is an existing group conversation
  const groupConv = await prisma.conversation.findFirst({
    where: { id: receiverOrConvId, isGroup: true },
    include: { participants: true },
  });

  if (groupConv) {
    // Check if sender is a participant
    const isParticipant = groupConv.participants.some((p) => p.userId === senderId);
    if (!isParticipant) {
      throw new AppError(status.FORBIDDEN, "You are not a participant in this group");
    }

    // Create group message
    const savedMessage = await prisma.message.create({
      data: {
        conversationId: groupConv.id,
        senderId,
        receiverId: null,
        message,
        messageType,
        mediaUrl,
        fileName,
        fileSize,
        callDuration: payload.callDuration ?? null,
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
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                profilePicUrl: true,
              },
            },
          },
        },
      },
    });

    // Update conversation metadata
    await prisma.conversation.update({
      where: { id: groupConv.id },
      data: {
        lastMessage: `${sender.fullName}: ${preview}`,
        lastMessageTime: now,
      },
    });

    // Increment unread count for other participants
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId: groupConv.id,
        userId: { not: senderId },
      },
      data: {
        unreadCount: { increment: 1 },
      },
    });

    const formatted = {
      ...formatMessage(savedMessage),
      tempId: tempId || null,
    };

    // Socket notification to other members
    if (emitGroupMessageCallback) {
      const recipientIds = groupConv.participants
        .map((p) => p.userId)
        .filter((uid) => uid !== senderId);
      try {
        emitGroupMessageCallback(recipientIds, formatted);
      } catch {
        // Non-blocking
      }
    }

    return formatted;
  }

  // 2. Otherwise handle 1-on-1 private chat
  let targetReceiverId: string = receiverOrConvId;
  let targetConversationId: string | null = null;

  // Check if receiverOrConvId is an existing 1-on-1 conversation
  const directConv = await prisma.conversation.findFirst({
    where: { id: receiverOrConvId, isGroup: false },
    include: { participants: true },
  });

  if (directConv) {
    targetConversationId = directConv.id;
    const otherParticipant = directConv.participants.find((p) => p.userId !== senderId);
    if (!otherParticipant) {
      throw new AppError(status.BAD_REQUEST, "Conversation has no valid recipient");
    }
    targetReceiverId = otherParticipant.userId;
  } else {
    // receiverOrConvId is a user ID
    const receiver = await prisma.user.findUnique({
      where: { id: receiverOrConvId },
    });
    if (!receiver) {
      throw new AppError(status.NOT_FOUND, "Receiver not found");
    }
    targetReceiverId = receiver.id;
  }

  // Create 1-on-1 message record
  const savedMessage = await prisma.message.create({
    data: {
      senderId,
      receiverId: targetReceiverId,
      message,
      messageType,
      mediaUrl,
      fileName,
      fileSize,
      callDuration: payload.callDuration ?? null,
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
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profilePicUrl: true,
            },
          },
        },
      },
    },
  });

  // Manage conversation record
  if (targetConversationId) {
    await prisma.conversation.update({
      where: { id: targetConversationId },
      data: {
        lastMessage: preview,
        lastMessageTime: now,
      },
    });

    await prisma.message.update({
      where: { id: savedMessage.id },
      data: { conversationId: targetConversationId },
    });
  } else {
    const existingConv = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: senderId } } },
          { participants: { some: { userId: targetReceiverId } } },
        ],
      },
    });

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
          isGroup: false,
          lastMessage: preview,
          lastMessageTime: now,
          participants: {
            create: [{ userId: senderId }, { userId: targetReceiverId }],
          },
          messages: {
            connect: { id: savedMessage.id },
          },
        },
      });
    }
  }

  const formatted = {
    ...formatMessage(savedMessage),
    tempId: tempId || null,
  };

  // Socket notification to receiver
  if (emitMessageCallback) {
    try {
      emitMessageCallback(targetReceiverId, formatted);
    } catch {
      // Non-blocking
    }
  }

  return formatted;
};

const getConversations = async (
  userId: string
): Promise<IConversationItemResponse[]> => {
  // 1. Fetch 1-on-1 message partners
  const messages = await prisma.message.findMany({
    where: {
      conversation: { isGroup: false },
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    select: {
      senderId: true,
      receiverId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const partnerIdSet = new Set<string>();
  messages.forEach((m) => {
    if (m.senderId !== userId && m.senderId) partnerIdSet.add(m.senderId);
    if (m.receiverId !== userId && m.receiverId) partnerIdSet.add(m.receiverId);
  });

  // Also include following / followers
  const follows = await prisma.follow.findMany({
    where: {
      OR: [{ followerId: userId }, { followingId: userId }],
    },
    select: {
      followerId: true,
      followingId: true,
    },
  });
  follows.forEach((f) => {
    if (f.followerId !== userId) partnerIdSet.add(f.followerId);
    if (f.followingId !== userId) partnerIdSet.add(f.followingId);
  });

  const partnerIds = Array.from(partnerIdSet);
  let oneOnOneConversations: IConversationItemResponse[] = [];

  if (partnerIds.length > 0) {
    const partners = await prisma.user.findMany({
      where: { id: { in: partnerIds } },
      select: {
        id: true,
        fullName: true,
        profilePicUrl: true,
      },
    });

    oneOnOneConversations = await Promise.all(
      partners.map(async (p) => {
        const lastMessage = await prisma.message.findFirst({
          where: {
            conversation: { isGroup: false },
            OR: [
              { senderId: userId, receiverId: p.id },
              { senderId: p.id, receiverId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
        });

        const unreadCount = await prisma.message.count({
          where: {
            conversation: { isGroup: false },
            senderId: p.id,
            receiverId: userId,
            isRead: false,
          },
        });

        const isFollowingPartner = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: userId,
              followingId: p.id,
            },
          },
        });

        const hasSentToPartner = await prisma.message.findFirst({
          where: {
            conversation: { isGroup: false },
            senderId: userId,
            receiverId: p.id,
          },
        });

        const isRequest =
          !isFollowingPartner && !hasSentToPartner && Boolean(lastMessage);

        return {
          id: p.id,
          friendId: p.id,
          friendName: p.fullName,
          friendProfilePicture: p.profilePicUrl,
          lastMessage: lastMessage ? lastMessage.message || "Media" : null,
          unreadCount,
          updatedAt: lastMessage?.createdAt || new Date(0),
          isRequest,
          isGroup: false,
        };
      })
    );
  }

  // 2. Fetch Group Conversations
  const groupParticipants = await prisma.conversationParticipant.findMany({
    where: {
      userId,
      conversation: { isGroup: true },
    },
    include: {
      conversation: {
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  profilePicUrl: true,
                },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  const groupConversations: IConversationItemResponse[] = groupParticipants.map(
    (gp) => {
      const conv = gp.conversation;
      const lastMsg = conv.messages[0];
      return {
        id: conv.id,
        friendId: conv.id,
        friendName: conv.name || "Group Chat",
        friendProfilePicture: conv.avatar || null,
        lastMessage: lastMsg ? lastMsg.message || "Attachment" : conv.lastMessage || null,
        unreadCount: gp.unreadCount,
        updatedAt: lastMsg?.createdAt || conv.lastMessageTime || conv.updatedAt,
        isRequest: false,
        isGroup: true,
        adminId: conv.adminId,
        participants: conv.participants.map((p) => ({
          userId: p.userId,
          name: p.user.fullName,
          avatar: p.user.profilePicUrl,
        })),
      };
    }
  );

  const allConversations = [...oneOnOneConversations, ...groupConversations];
  allConversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return allConversations;
};

const getMessages = async (
  userId: string,
  targetId: string
): Promise<IMessageItemResponse[]> => {
  // 1. Check if targetId is an existing conversation ID (group or 1-on-1)
  const existingConv = await prisma.conversation.findUnique({
    where: { id: targetId },
  });

  if (existingConv) {
    const messages = await prisma.message.findMany({
      where: {
        conversationId: targetId,
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
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                profilePicUrl: true,
              },
            },
          },
        },
      },
    });

    return messages.map(formatMessage);
  }

  // Otherwise fetch 1-on-1 messages
  const messages = await prisma.message.findMany({
    where: {
      conversation: { isGroup: false },
      OR: [
        { senderId: userId, receiverId: targetId },
        { senderId: targetId, receiverId: userId },
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
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              profilePicUrl: true,
            },
          },
        },
      },
    },
  });

  return messages.map(formatMessage);
};

const markAsRead = async (
  userId: string,
  targetId: string
): Promise<void> => {
  // If targetId is a group conversation
  const groupConv = await prisma.conversation.findFirst({
    where: { id: targetId, isGroup: true },
  });

  if (groupConv) {
    await prisma.conversationParticipant.updateMany({
      where: {
        conversationId: targetId,
        userId,
      },
      data: {
        unreadCount: 0,
      },
    });
    return;
  }

  // 1-on-1 messages
  await prisma.message.updateMany({
    where: {
      senderId: targetId,
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
  const [directCount, groupCounts] = await Promise.all([
    prisma.message.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    }),
    prisma.conversationParticipant.aggregate({
      where: {
        userId,
        conversation: { isGroup: true },
      },
      _sum: {
        unreadCount: true,
      },
    }),
  ]);

  const count = directCount + (groupCounts._sum.unreadCount || 0);
  return { count };
};

const uploadMessageMedia = async (
  file: Express.Multer.File
): Promise<IUploadMediaResponse> => {
  if (!file) {
    throw new AppError(status.BAD_REQUEST, "No file uploaded");
  }

  const mimeType = file.mimetype;
  const fileType: "image" | "video" | "document" = mimeType.startsWith("image")
    ? "image"
    : mimeType.startsWith("video")
    ? "video"
    : "document";

  const mediaUrl =
    file.path ||
    (file.buffer ? `data:${mimeType};base64,${file.buffer.toString("base64")}` : "");

  return {
    url: mediaUrl,
    mediaUrl,
    type: fileType,
    name: file.originalname,
    size: file.size,
  };
};

const createGroup = async (
  adminId: string,
  payload: ICreateGroupPayload
): Promise<IConversationItemResponse> => {
  const { name, avatar, memberIds = [] } = payload;
  if (!name || !name.trim()) {
    throw new AppError(status.BAD_REQUEST, "Group name is required");
  }

  const uniqueMemberIds = Array.from(new Set([adminId, ...memberIds]));
  if (uniqueMemberIds.length < 2) {
    throw new AppError(status.BAD_REQUEST, "At least one additional member is required");
  }

  // Verify all members exist
  const existingUsers = await prisma.user.findMany({
    where: { id: { in: uniqueMemberIds } },
    select: { id: true, fullName: true, profilePicUrl: true },
  });

  if (existingUsers.length !== uniqueMemberIds.length) {
    throw new AppError(status.BAD_REQUEST, "One or more users not found");
  }

  const newGroup = await prisma.conversation.create({
    data: {
      isGroup: true,
      name: name.trim(),
      avatar: avatar || null,
      adminId,
      lastMessage: "Group created",
      lastMessageTime: new Date(),
      participants: {
        create: uniqueMemberIds.map((uid) => ({ userId: uid })),
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, fullName: true, profilePicUrl: true },
          },
        },
      },
    },
  });

  return {
    id: newGroup.id,
    friendId: newGroup.id,
    friendName: newGroup.name!,
    friendProfilePicture: newGroup.avatar,
    lastMessage: newGroup.lastMessage,
    unreadCount: 0,
    updatedAt: newGroup.createdAt,
    isRequest: false,
    isGroup: true,
    adminId: newGroup.adminId,
    participants: newGroup.participants.map((p) => ({
      userId: p.userId,
      name: p.user.fullName,
      avatar: p.user.profilePicUrl,
    })),
  };
};

const toggleReaction = async (
  userId: string,
  messageId: string,
  reaction: string
): Promise<{ messageId: string; reactions: IMessageReactionItem[] }> => {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: {
        include: { participants: true },
      },
    },
  });

  if (!message) {
    throw new AppError(status.NOT_FOUND, "Message not found");
  }

  // Check if user already reacted
  const existingReaction = await prisma.messageReaction.findUnique({
    where: {
      messageId_userId: {
        messageId,
        userId,
      },
    },
  });

  if (existingReaction && existingReaction.reaction === reaction) {
    // Toggle OFF
    await prisma.messageReaction.delete({
      where: { id: existingReaction.id },
    });
  } else if (existingReaction) {
    // Update to new reaction
    await prisma.messageReaction.update({
      where: { id: existingReaction.id },
      data: { reaction },
    });
  } else {
    // Add new reaction
    await prisma.messageReaction.create({
      data: {
        messageId,
        userId,
        reaction,
      },
    });
  }

  // Fetch updated reactions list
  const allReactions = await prisma.messageReaction.findMany({
    where: { messageId },
    include: {
      user: {
        select: { id: true, fullName: true, profilePicUrl: true },
      },
    },
  });

  const formattedReactions: IMessageReactionItem[] = allReactions.map((r) => ({
    id: r.id,
    messageId: r.messageId,
    userId: r.userId,
    userName: r.user.fullName,
    userAvatar: r.user.profilePicUrl,
    reaction: r.reaction,
    createdAt: r.createdAt,
  }));

  // Determine recipients to notify via Socket
  let recipientIds: string[] = [];
  if (message.conversation?.isGroup && message.conversation.participants) {
    recipientIds = message.conversation.participants.map((p) => p.userId);
  } else {
    recipientIds = [message.senderId, message.receiverId!].filter(Boolean);
  }

  if (emitReactionCallback) {
    try {
      emitReactionCallback(recipientIds, {
        messageId,
        reactions: formattedReactions,
      });
    } catch {
      // Non-blocking
    }
  }

  return {
    messageId,
    reactions: formattedReactions,
  };
};

const acceptMessageRequest = async (
  userId: string,
  partnerId: string
): Promise<void> => {
  await prisma.follow.upsert({
    where: {
      followerId_followingId: {
        followerId: userId,
        followingId: partnerId,
      },
    },
    update: {},
    create: {
      followerId: userId,
      followingId: partnerId,
    },
  });

  await prisma.message.updateMany({
    where: {
      senderId: partnerId,
      receiverId: userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });
};

const declineMessageRequest = async (
  userId: string,
  partnerId: string
): Promise<void> => {
  await prisma.message.deleteMany({
    where: {
      senderId: partnerId,
      receiverId: userId,
    },
  });
};

export const messageService = {
  sendMessage,
  getConversations,
  getMessages,
  markAsRead,
  getUnreadCount,
  uploadMessageMedia,
  createGroup,
  toggleReaction,
  acceptMessageRequest,
  declineMessageRequest,
};
