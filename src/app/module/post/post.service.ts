import { Prisma } from "@prisma/client";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { IPaginatedResult, IPaginationOptions } from "../../interfaces/common.interface";
import { prisma } from "../../lib/prisma";
import { notificationService } from "../notification/notification.service";
import {
  ICommentPayload,
  ILikeResponse,
  ILikerUserResponse,
  IPostCommentResponse,
  IPostFilters,
  IPostMedia,
  IPostResponse,
  IRepostResponse,
  IRepostUserResponse,
  IShareResponse,
  IToggleInterestResponse,
  IToggleNotInterestResponse,
  IToggleSaveResponse,
} from "./post.interface";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatPost = (post: any): IPostResponse => {
  const media: IPostMedia | null = post.mediaUrl
    ? {
        url: post.mediaUrl,
        publicId: post.mediaPublicId,
        resourceType: post.mediaType,
        mimeType: post.mediaMimeType,
        size: post.mediaSize,
        uploadedAt: post.createdAt,
      }
    : null;

  const likesArray = (post.likes || []).map((l: { userId: string }) => l.userId);
  const repostsArray = (post.reposts || []).map((r: { userId: string }) => r.userId);

  // Group root comments and replies
  const rawComments = post.comments || [];
  const rootComments: IPostCommentResponse[] = [];
  const replyMap = new Map<string, IPostCommentResponse[]>();

  rawComments.forEach((c: any) => {
    const formattedComment: IPostCommentResponse = {
      id: c.id,
      _id: c.id,
      postId: c.postId,
      userId: c.userId,
      userName: c.user?.fullName || "User",
      userProfilePicture: c.user?.profilePicUrl || null,
      text: c.text,
      parentId: c.parentId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      replies: [],
    };

    if (c.parentId) {
      if (!replyMap.has(c.parentId)) {
        replyMap.set(c.parentId, []);
      }
      replyMap.get(c.parentId)!.push(formattedComment);
    } else {
      rootComments.push(formattedComment);
    }
  });

  rootComments.forEach((root) => {
    root.replies = replyMap.get(root.id) || [];
  });

  const originalPostFormatted = post.originalPost
    ? {
        id: post.originalPost.id,
        _id: post.originalPost.id,
        userId: post.originalPost.userId,
        userName: post.originalPost.user?.fullName || "User",
        userProfilePicture: post.originalPost.user?.profilePicUrl || null,
        description: post.originalPost.description,
        media: post.originalPost.mediaUrl
          ? {
              url: post.originalPost.mediaUrl,
              publicId: post.originalPost.mediaPublicId,
              resourceType: post.originalPost.mediaType,
              mimeType: post.originalPost.mediaMimeType,
              size: post.originalPost.mediaSize,
              uploadedAt: post.originalPost.createdAt,
            }
          : null,
      }
    : null;

  return {
    id: post.id,
    _id: post.id,
    userId: post.userId,
    userName: post.user?.fullName || "User",
    userEmail: post.user?.email || "",
    userProfilePicture: post.user?.profilePicUrl || null,
    description: post.description,
    media,
    likes: likesArray,
    likesCount: likesArray.length,
    comments: rootComments,
    commentsCount: rawComments.length,
    shares: [],
    sharesCount: post._count?.sharedPosts ?? 0,
    reposts: repostsArray,
    repostsCount: repostsArray.length,
    isShare: post.isShare,
    isRepost: post.isRepost,
    originalPost: originalPostFormatted,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    isActive: post.isActive,
  };
};

const postInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      profilePicUrl: true,
    },
  },
  likes: {
    select: {
      userId: true,
    },
  },
  reposts: {
    select: {
      userId: true,
    },
  },
  comments: {
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          profilePicUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  originalPost: {
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
  _count: {
    select: {
      sharedPosts: true,
    },
  },
};

const createPost = async (
  userId: string,
  description?: string,
  file?: Express.Multer.File
): Promise<IPostResponse> => {
  if ((!description || description.trim() === "") && !file) {
    throw new AppError(
      status.BAD_REQUEST,
      "Please add a description or media to your post"
    );
  }

  const isVideo = file?.mimetype?.startsWith("video");
  const mediaType = file ? (isVideo ? "video" : "image") : null;

  const post = await prisma.post.create({
    data: {
      userId,
      description: description?.trim() || "",
      mediaUrl: file?.path || null,
      mediaPublicId: file?.filename || null,
      mediaType: mediaType,
      mediaMimeType: file?.mimetype || null,
      mediaSize: file?.size || null,
      isActive: true,
    },
    include: postInclude,
  });

  return formatPost(post);
};

const getAllPosts = async (
  filters: IPostFilters,
  pagination: IPaginationOptions
): Promise<IPaginatedResult<IPostResponse>> => {
  const page = Number(pagination.page) || 1;
  const limit = Number(pagination.limit) || 10;
  const skip = (page - 1) * limit;

  const whereClause: Prisma.PostWhereInput = {
    isActive: true,
  };

  if (filters.search) {
    whereClause.description = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: postInclude,
    }),
    prisma.post.count({ where: whereClause }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: posts.map(formatPost),
  };
};

const getPostById = async (postId: string): Promise<IPostResponse> => {
  const post = await prisma.post.findUnique({
    where: { id: postId, isActive: true },
    include: postInclude,
  });

  if (!post) {
    throw new AppError(status.NOT_FOUND, "Post not found");
  }

  return formatPost(post);
};

const getUserPosts = async (targetUserId: string): Promise<IPostResponse[]> => {
  const posts = await prisma.post.findMany({
    where: { userId: targetUserId, isActive: true },
    orderBy: { createdAt: "desc" },
    include: postInclude,
  });

  return posts.map(formatPost);
};

const getPostLikes = async (postId: string): Promise<ILikerUserResponse[]> => {
  const likes = await prisma.postLike.findMany({
    where: { postId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profilePicUrl: true,
        },
      },
    },
  });

  return likes.map((like) => ({
    id: like.user.id,
    _id: like.user.id,
    name: like.user.fullName,
    userName: like.user.fullName,
    profilePicture: like.user.profilePicUrl,
  }));
};

const toggleLike = async (
  userId: string,
  postId: string
): Promise<ILikeResponse> => {
  const post = await prisma.post.findUnique({
    where: { id: postId, isActive: true },
    include: { user: true },
  });

  if (!post) {
    throw new AppError(status.NOT_FOUND, "Post not found");
  }

  const existingLike = await prisma.postLike.findUnique({
    where: {
      postId_userId: { postId, userId },
    },
  });

  if (existingLike) {
    await prisma.postLike.delete({
      where: {
        postId_userId: { postId, userId },
      },
    });

    const likesCount = await prisma.postLike.count({ where: { postId } });
    return { liked: false, likesCount };
  }

  await prisma.postLike.create({
    data: { postId, userId },
  });

  const likesCount = await prisma.postLike.count({ where: { postId } });

  // Send notification to post owner if not liking own post
  if (post.userId !== userId) {
    const actor = await prisma.user.findUnique({ where: { id: userId } });
    if (actor) {
      await notificationService.createNotification({
        userId: post.userId,
        actorId: userId,
        type: "post_like",
        postId,
        message: `${actor.fullName} liked your post`,
      });
    }
  }

  return { liked: true, likesCount };
};

const addComment = async (
  userId: string,
  postId: string,
  payload: ICommentPayload
): Promise<IPostCommentResponse> => {
  const { text, parentCommentId } = payload;

  if (!text || text.trim() === "") {
    throw new AppError(status.BAD_REQUEST, "Comment text is required");
  }

  const post = await prisma.post.findUnique({
    where: { id: postId, isActive: true },
    include: { user: true },
  });

  if (!post) {
    throw new AppError(status.NOT_FOUND, "Post not found");
  }

  const comment = await prisma.comment.create({
    data: {
      postId,
      userId,
      parentId: parentCommentId || null,
      text: text.trim(),
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          profilePicUrl: true,
        },
      },
    },
  });

  // Notify post owner
  if (post.userId !== userId) {
    const actor = await prisma.user.findUnique({ where: { id: userId } });
    if (actor) {
      const truncated =
        text.trim().substring(0, 50) + (text.trim().length > 50 ? "..." : "");
      const notifMessage = parentCommentId
        ? `${actor.fullName} replied to a comment on your post: "${truncated}"`
        : `${actor.fullName} commented on your post: "${truncated}"`;

      await notificationService.createNotification({
        userId: post.userId,
        actorId: userId,
        type: "post_comment",
        postId,
        commentId: comment.id,
        message: notifMessage,
      });
    }
  }

  return {
    id: comment.id,
    _id: comment.id,
    postId: comment.postId,
    userId: comment.userId,
    userName: comment.user.fullName,
    userProfilePicture: comment.user.profilePicUrl,
    text: comment.text,
    parentId: comment.parentId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    replies: [],
  };
};

const editComment = async (
  userId: string,
  postId: string,
  commentId: string,
  text: string
): Promise<void> => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.postId !== postId) {
    throw new AppError(status.NOT_FOUND, "Comment not found");
  }

  if (comment.userId !== userId) {
    throw new AppError(status.FORBIDDEN, "You can only edit your own comments");
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { text: text.trim() },
  });
};

const deleteComment = async (
  userId: string,
  userRole: string,
  postId: string,
  commentId: string
): Promise<void> => {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment || comment.postId !== postId) {
    throw new AppError(status.NOT_FOUND, "Comment not found");
  }

  if (comment.userId !== userId && userRole !== "admin") {
    throw new AppError(status.FORBIDDEN, "You can only delete your own comments");
  }

  await prisma.comment.delete({
    where: { id: commentId },
  });
};

const sharePost = async (
  userId: string,
  postId: string
): Promise<IShareResponse> => {
  const originalPost = await prisma.post.findUnique({
    where: { id: postId, isActive: true },
    include: { user: true },
  });

  if (!originalPost) {
    throw new AppError(status.NOT_FOUND, "Post not found");
  }

  const sharedPost = await prisma.post.create({
    data: {
      userId,
      originalPostId: postId,
      isShare: true,
      description: "",
      isActive: true,
    },
  });

  if (originalPost.userId !== userId) {
    const actor = await prisma.user.findUnique({ where: { id: userId } });
    if (actor) {
      await notificationService.createNotification({
        userId: originalPost.userId,
        actorId: userId,
        type: "post_share",
        postId,
        message: `${actor.fullName} shared your post`,
      });
    }
  }

  return {
    _id: sharedPost.id,
    id: sharedPost.id,
    postId,
    sharedPostDoc: sharedPost,
  };
};

const repost = async (
  userId: string,
  postId: string
): Promise<IRepostResponse> => {
  const originalPost = await prisma.post.findUnique({
    where: { id: postId, isActive: true },
    include: { user: true },
  });

  if (!originalPost) {
    throw new AppError(status.NOT_FOUND, "Post not found");
  }

  const existing = await prisma.postRepost.findUnique({
    where: {
      postId_userId: { postId, userId },
    },
  });

  if (existing) {
    throw new AppError(status.BAD_REQUEST, "You have already reposted this post");
  }

  await prisma.postRepost.create({
    data: { postId, userId },
  });

  const repostDoc = await prisma.post.create({
    data: {
      userId,
      originalPostId: postId,
      isShare: true,
      isRepost: true,
      description: "",
      isActive: true,
    },
  });

  if (originalPost.userId !== userId) {
    const actor = await prisma.user.findUnique({ where: { id: userId } });
    if (actor) {
      await notificationService.createNotification({
        userId: originalPost.userId,
        actorId: userId,
        type: "post_repost",
        postId,
        message: `${actor.fullName} reposted your post`,
      });
    }
  }

  return { repostId: repostDoc.id };
};

const getReposts = async (postId: string): Promise<IRepostUserResponse[]> => {
  const reposts = await prisma.postRepost.findMany({
    where: { postId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          profilePicUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return reposts.map((r) => ({
    userId: r.user.id,
    userName: r.user.fullName,
    userProfilePicture: r.user.profilePicUrl,
    repostedAt: r.createdAt,
  }));
};

const toggleSavePost = async (
  userId: string,
  postId: string
): Promise<IToggleSaveResponse> => {
  const existing = await prisma.savedPost.findUnique({
    where: {
      userId_postId: { userId, postId },
    },
  });

  if (existing) {
    await prisma.savedPost.delete({
      where: {
        userId_postId: { userId, postId },
      },
    });
    return { isSaved: false };
  }

  await prisma.savedPost.create({
    data: { userId, postId },
  });
  return { isSaved: true };
};

const toggleInterested = async (
  userId: string,
  postId: string
): Promise<IToggleInterestResponse> => {
  const existing = await prisma.interestedPost.findUnique({
    where: {
      userId_postId: { userId, postId },
    },
  });

  if (existing) {
    await prisma.interestedPost.delete({
      where: {
        userId_postId: { userId, postId },
      },
    });
    return { isInterested: false };
  }

  await prisma.interestedPost.create({
    data: { userId, postId },
  });
  return { isInterested: true };
};

const toggleNotInterested = async (
  userId: string,
  postId: string
): Promise<IToggleNotInterestResponse> => {
  const existing = await prisma.notInterestedPost.findUnique({
    where: {
      userId_postId: { userId, postId },
    },
  });

  if (existing) {
    await prisma.notInterestedPost.delete({
      where: {
        userId_postId: { userId, postId },
      },
    });
    return { isNotInterested: false };
  }

  await prisma.notInterestedPost.create({
    data: { userId, postId },
  });
  return { isNotInterested: true };
};

const updatePost = async (
  userId: string,
  userRole: string,
  postId: string,
  description: string
): Promise<IPostResponse> => {
  const post = await prisma.post.findUnique({
    where: { id: postId, isActive: true },
  });

  if (!post) {
    throw new AppError(status.NOT_FOUND, "Post not found");
  }

  if (post.userId !== userId && userRole !== "admin") {
    throw new AppError(status.FORBIDDEN, "You can only edit your own posts");
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { description },
    include: postInclude,
  });

  return formatPost(updated);
};

const deletePost = async (
  userId: string,
  userRole: string,
  postId: string
): Promise<void> => {
  const post = await prisma.post.findUnique({
    where: { id: postId, isActive: true },
  });

  if (!post) {
    throw new AppError(status.NOT_FOUND, "Post not found");
  }

  if (post.userId !== userId && userRole !== "admin") {
    throw new AppError(status.FORBIDDEN, "You can only delete your own posts");
  }

  await prisma.post.update({
    where: { id: postId },
    data: { isActive: false, deletedAt: new Date() },
  });
};

export const postService = {
  createPost,
  getAllPosts,
  getPostById,
  getUserPosts,
  getPostLikes,
  toggleLike,
  addComment,
  editComment,
  deleteComment,
  sharePost,
  repost,
  getReposts,
  toggleSavePost,
  toggleInterested,
  toggleNotInterested,
  updatePost,
  deletePost,
};

