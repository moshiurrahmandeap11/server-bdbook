export interface IFollowUser {
  id: string;
  _id: string;
  fullName: string;
  username: string | null;
  email: string;
  profilePicture: {
    url: string | null;
  } | null;
  profilePicUrl: string | null;
  bio: string | null;
  followedAt: Date;
}

export interface IFollowStatusResponse {
  isFollowing: boolean;
}

export interface IFollowCountResponse {
  count: number;
}

