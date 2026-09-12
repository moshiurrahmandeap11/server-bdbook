export interface IFriendItemResponse {
  _id: string;
  id: string;
  fullName: string;
  email: string;
  profilePicture: {
    url: string | null;
  };
  friendSince: Date;
}

export interface IFriendRequestItemResponse {
  _id: string;
  id: string;
  senderId: string;
  senderName: string;
  senderProfilePicture: string | null;
  receiverId: string;
  receiverName: string;
  receiverProfilePicture: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFollowerItemResponse {
  _id: string;
  id: string;
  fullName: string;
  profilePicture: {
    url: string | null;
  };
  email: string;
  status: string;
  requestId: string;
  requestedAt: Date;
}

export interface IFriendStatusResponse {
  status: "friends" | "request_sent" | "request_received" | "not_friends";
}

export interface IFriendCountResponse {
  count: number;
}

