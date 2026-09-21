import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { friendService } from "./friend.service";

const sendFriendRequest = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  await friendService.sendFriendRequest(req.user!.id, userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Friend request sent successfully",
  });
});

const acceptFriendRequest = catchAsync(async (req: Request, res: Response) => {
  const { requestId } = req.params;
  await friendService.acceptFriendRequest(req.user!.id, requestId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Friend request accepted",
  });
});

const declineFriendRequest = catchAsync(async (req: Request, res: Response) => {
  const { requestId } = req.params;
  await friendService.declineFriendRequest(req.user!.id, requestId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Friend request declined",
  });
});

const getFriendRequests = catchAsync(async (req: Request, res: Response) => {
  const result = await friendService.getFriendRequests(req.user!.id);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Friend requests fetched successfully",
    data: result,
  });
});

const getFriends = catchAsync(async (req: Request, res: Response) => {
  const result = await friendService.getFriends(req.user!.id);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Friends fetched successfully",
    data: result,
  });
});

const getUserFriends = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await friendService.getUserFriends(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "User friends fetched successfully",
    data: result,
  });
});

const getFriendsCount = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await friendService.getFriendsCount(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Friends count fetched successfully",
    count: result.count,
    data: result,
  });
});

const getFollowers = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await friendService.getFollowers(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Followers fetched successfully",
    data: result,
  });
});

const getFollowersCount = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await friendService.getFollowersCount(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Followers count fetched successfully",
    count: result.count,
    data: result,
  });
});

const getFollowing = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await friendService.getFollowing(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Following fetched successfully",
    data: result,
  });
});

const getFollowingCount = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await friendService.getFollowingCount(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Following count fetched successfully",
    count: result.count,
    data: result,
  });
});

const getFriendStatus = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await friendService.getFriendStatus(req.user!.id, userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Friend status fetched successfully",
    data: result,
  });
});

const removeFriend = catchAsync(async (req: Request, res: Response) => {
  const { friendId } = req.params;
  await friendService.removeFriend(req.user!.id, friendId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Friend removed successfully",
  });
});

const getSavedPosts = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await friendService.getSavedPosts(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Saved posts fetched successfully",
    data: result,
  });
});

export const friendController = {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getFriendRequests,
  getFriends,
  getUserFriends,
  getFriendsCount,
  getFollowers,
  getFollowersCount,
  getFollowing,
  getFollowingCount,
  getFriendStatus,
  removeFriend,
  getSavedPosts,
};

