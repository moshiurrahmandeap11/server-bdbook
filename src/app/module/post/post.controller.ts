import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { postService } from "./post.service";

const createPost = catchAsync(async (req: Request, res: Response) => {
  const result = await postService.createPost(
    req.user!.id,
    req.body.description,
    req.file as Express.Multer.File
  );

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Post created successfully",
    data: result,
  });
});

const getAllPosts = catchAsync(async (req: Request, res: Response) => {
  const filters = { search: req.query.search as string | undefined };
  const pagination = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
  };

  const result = await postService.getAllPosts(filters, pagination);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Posts fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

const getPostById = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const result = await postService.getPostById(postId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Post fetched successfully",
    data: result,
  });
});

const getUserPosts = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await postService.getUserPosts(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "User posts fetched successfully",
    data: result,
  });
});

const getPostLikes = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const result = await postService.getPostLikes(postId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Likes fetched successfully",
    data: result,
  });
});

const toggleLike = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const result = await postService.toggleLike(req.user!.id, postId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.liked ? "Post liked successfully" : "Post unliked successfully",
    data: result,
  });
});

const addComment = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const result = await postService.addComment(req.user!.id, postId, req.body);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: req.body.parentCommentId
      ? "Reply added successfully"
      : "Comment added successfully",
    data: result,
  });
});

const editComment = catchAsync(async (req: Request, res: Response) => {
  const { postId, commentId } = req.params;
  await postService.editComment(req.user!.id, postId, commentId, req.body.text);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Comment updated successfully",
  });
});

const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const { postId, commentId } = req.params;
  await postService.deleteComment(
    req.user!.id,
    req.user!.role,
    postId,
    commentId
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Comment deleted successfully",
  });
});

const sharePost = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const result = await postService.sharePost(req.user!.id, postId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Post shared successfully",
    data: result,
  });
});

const repost = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const result = await postService.repost(req.user!.id, postId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Post reposted successfully",
    data: result,
  });
});

const getReposts = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const result = await postService.getReposts(postId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Reposts fetched successfully",
    data: result,
  });
});

const savePost = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const result = await postService.toggleSavePost(req.user!.id, postId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.isSaved ? "Post saved" : "Post unsaved",
    data: result,
  });
});

const markInterested = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const result = await postService.toggleInterested(req.user!.id, postId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.isInterested
      ? "Marked as interested"
      : "Removed from interested",
    data: result,
  });
});

const markNotInterested = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const result = await postService.toggleNotInterested(req.user!.id, postId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: result.isNotInterested
      ? "Marked as not interested"
      : "Removed from not interested",
    data: result,
  });
});

const updatePost = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  const result = await postService.updatePost(
    req.user!.id,
    req.user!.role,
    postId,
    req.body.description
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Post updated successfully",
    data: result,
  });
});

const deletePost = catchAsync(async (req: Request, res: Response) => {
  const { postId } = req.params;
  await postService.deletePost(req.user!.id, req.user!.role, postId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Post deleted successfully",
  });
});

export const postController = {
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
  savePost,
  markInterested,
  markNotInterested,
  updatePost,
  deletePost,
};

