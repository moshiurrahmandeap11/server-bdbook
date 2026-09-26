export interface ICreatePostPayload {
  description?: string;
}

export interface IPostFilters {
  search?: string;
}

export interface ICommentPayload {
  text: string;
  parentCommentId?: string;
}

export interface IPostAuthor {
  id: string;
  _id?: string;
  fullName: string;
  email: string;
  profilePicUrl?: string | null;
  profilePicture?: {
    url: string | null;
  } | null;
}

export interface IPostCommentResponse {
  id: string;
  _id?: string;
  postId: string;
  userId: string;
  userName: string;
  userUsername?: string | null;
  userProfilePicture: string | null;
  text: string;
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  replies?: IPostCommentResponse[];
}

export interface IPostMedia {
  url: string;
  publicId?: string | null;
  resourceType?: string | null;
  mimeType?: string | null;
  size?: number | null;
  uploadedAt?: Date | null;
}

export interface IOriginalPostSummary {
  id: string;
  _id?: string;
  userId: string;
  userName: string;
  userProfilePicture: string | null;
  username?: string | null;
  user?: IPostAuthor | null;
  description: string | null;
  media: IPostMedia | null;
}

export interface IPostResponse {
  id: string;
  _id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userProfilePicture: string | null;
  username?: string | null;
  user?: IPostAuthor | null;
  description: string | null;
  media: IPostMedia | null;
  likes: string[];
  likesCount: number;
  comments: IPostCommentResponse[];
  commentsCount: number;
  shares: string[];
  sharesCount: number;
  reposts?: string[];
  repostsCount?: number;
  isShare: boolean;
  isRepost: boolean;
  originalPost?: IOriginalPostSummary | null;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isSaved?: boolean;
  savedAt?: Date;
}

export interface ILikeResponse {
  liked: boolean;
  likesCount?: number;
}

export interface IShareResponse {
  _id: string;
  id: string;
  postId: string;
  sharedPostDoc?: unknown;
}

export interface IRepostResponse {
  repostId: string;
}

export interface IToggleSaveResponse {
  isSaved: boolean;
}

export interface IToggleInterestResponse {
  isInterested: boolean;
}

export interface IToggleNotInterestResponse {
  isNotInterested: boolean;
}

export interface ILikerUserResponse {
  _id: string;
  id: string;
  name: string;
  userName: string;
  profilePicture: string | null;
}

export interface IRepostUserResponse {
  userId: string;
  userName: string;
  userProfilePicture: string | null;
  repostedAt: Date;
}

