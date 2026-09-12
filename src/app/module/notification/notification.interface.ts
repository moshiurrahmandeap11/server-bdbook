import { NotificationType } from "@prisma/client";

export interface ICreateNotificationInput {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title?: string;
  message: string;
  postId?: string | null;
  commentId?: string | null;
  requestId?: string | null;
}

export interface INotificationActor {
  id: string;
  fullName: string;
  profilePicUrl?: string | null;
}

export interface INotificationItemResponse {
  _id: string;
  id: string;
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title?: string | null;
  message: string;
  postId?: string | null;
  commentId?: string | null;
  requestId?: string | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
  actor?: INotificationActor | null;
  data?: {
    postId?: string | null;
    commentId?: string | null;
    requestId?: string | null;
    actorId?: string | null;
    actorName?: string | null;
    actorProfilePicture?: string | null;
    message?: string;
  };
}

export interface IUnreadCountResponse {
  unreadCount: number;
}

