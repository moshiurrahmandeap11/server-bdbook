import { MessageType } from "@prisma/client";

export interface ISendMessagePayload {
  message?: string;
  messageType?: MessageType;
  mediaUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  tempId?: string | null;
  conversationId?: string | null;
}

export interface IMessageReactionItem {
  id: string;
  messageId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  reaction: string;
  createdAt: Date;
}

export interface IMessageItemResponse {
  _id: string;
  id: string;
  conversationId?: string | null;
  senderId: string;
  senderName: string;
  senderProfilePicture: string | null;
  receiverId: string | null;
  message: string;
  messageType: MessageType;
  mediaUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  isRead: boolean;
  isDelivered: boolean;
  createdAt: Date;
  updatedAt: Date;
  tempId?: string | null;
  reactions?: IMessageReactionItem[];
}

export interface IConversationParticipantItem {
  userId: string;
  name: string;
  avatar: string | null;
}

export interface IConversationItemResponse {
  id?: string;
  friendId: string;
  friendName: string;
  friendProfilePicture: string | null;
  lastMessage: string | null;
  unreadCount: number;
  updatedAt: Date;
  isRequest?: boolean;
  isGroup?: boolean;
  adminId?: string | null;
  participants?: IConversationParticipantItem[];
}

export interface IUnreadMessagesCountResponse {
  count: number;
}

export interface IUploadMediaResponse {
  url: string;
  type: "image" | "video" | "document";
  name: string;
  size: number;
}

export interface ICreateGroupPayload {
  name: string;
  avatar?: string | null;
  memberIds: string[];
}

export interface IToggleReactionPayload {
  reaction: string;
}
