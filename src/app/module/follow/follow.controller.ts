import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { followService } from "./follow.service";

const followUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await followService.followUser(req.user!.id, userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Followed successfully",
    data: result,
  });
});

const unfollowUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await followService.unfollowUser(req.user!.id, userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Unfollowed successfully",
    data: result,
  });
});

const getFollowStatus = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await followService.getFollowStatus(req.user!.id, userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Follow status fetched successfully",
    data: result,
  });
});

const getFollowers = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await followService.getFollowers(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Followers fetched successfully",
    data: result,
  });
});

const getFollowersCount = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await followService.getFollowersCount(userId);

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
  const result = await followService.getFollowing(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Following fetched successfully",
    data: result,
  });
});

const getFollowingCount = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await followService.getFollowingCount(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Following count fetched successfully",
    count: result.count,
    data: result,
  });
});

export const followController = {
  followUser,
  unfollowUser,
  getFollowStatus,
  getFollowers,
  getFollowersCount,
  getFollowing,
  getFollowingCount,
};

