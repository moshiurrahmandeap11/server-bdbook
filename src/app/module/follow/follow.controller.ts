import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import * as followService from "./follow.service";

export const followUser = catchAsync(async (req: any, res: Response) => {
  const result = await followService.followUser(req.user.id, req.params.userId);
  sendResponse(res, { statusCode: 200, success: true, message: "User followed successfully", data: result });
});
