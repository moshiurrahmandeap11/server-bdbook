import { Socket } from "socket.io";

export interface ICustomSocket extends Socket {
  userId?: string;
  userName?: string;
  userProfilePicture?: string | null;
  isGuest?: boolean;
  roomId?: string;
  callInfo?: {
    from: string;
    fromName: string;
    type: string;
    offer: unknown;
    to: string;
  };
}

export interface IRoomParticipant {
  userId: string;
  userName: string;
  userProfilePicture?: string | null;
}

export interface IRoomSession {
  id: string;
  name: string;
  createdBy: string;
  participants: IRoomParticipant[];
}

export interface ICreateRoomPayload {
  roomId: string;
  roomName: string;
  userId?: string;
  userName: string;
  userProfilePicture?: string | null;
}

export interface IJoinRoomPayload {
  roomId: string;
  userId?: string;
  userName?: string;
  userProfilePicture?: string | null;
}

export interface ISignalingOfferPayload {
  roomId: string;
  to: string;
  offer: unknown;
}

export interface ISignalingAnswerPayload {
  roomId: string;
  to: string;
  answer: unknown;
}

export interface IIceCandidatePayload {
  roomId: string;
  to: string;
  candidate: unknown;
}

export interface IRoomMessagePayload {
  roomId: string;
  message: string;
  userId: string;
  userName: string;
  userProfilePicture?: string | null;
}

export interface ICallUserPayload {
  to: string;
  from: string;
  fromName: string;
  type: string;
  offer: unknown;
}

export interface IAnswerCallPayload {
  to: string;
  answer: unknown;
}

export interface ITypingPayload {
  receiverId: string;
  isTyping: boolean;
}

export interface ISendSocketMessagePayload {
  receiverId: string;
  message?: string;
  messageType?: "text" | "image" | "video" | "file" | "share";
  mediaUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  tempId?: string | null;
}

