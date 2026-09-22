import { MessageType } from "@prisma/client";

export interface ISendMessagePayload {
  message?: string;
  messageType?: MessageType;
  mediaUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  tempId?: string | null;
}

export interface IMessageItemResponse {
  _id: string;
  id: string;
  senderId: string;
  senderName: string;
  senderProfilePicture: string | null;
  receiverId: string;
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
}

export interface IConversationItemResponse {
  friendId: string;
  friendName: string;
  friendProfilePicture: string | null;
  lastMessage: string | null;
  unreadCount: number;
  updatedAt: Date;
  isRequest?: boolean;
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

