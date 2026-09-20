import { Request, Response } from "express";
import status from "http-status";
import AppError from "../../errorHelpers/AppError";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { tokenUtils } from "../../utils/token";
import { authService } from "./auth.service";

const signup = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.signup(req.body);

  tokenUtils.setAccessTokenCookie(res, result.accessToken, req);
  tokenUtils.setRefreshTokenCookie(res, result.refreshToken, req);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Account created successfully",
    token: result.accessToken,
    user: result.user,
    data: {
      accessToken: result.accessToken,
      token: result.accessToken,
      user: result.user,
    },
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);

  tokenUtils.setAccessTokenCookie(res, result.accessToken, req);
  tokenUtils.setRefreshTokenCookie(res, result.refreshToken, req);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Login successful",
    token: result.accessToken,
    user: result.user,
    data: {
      accessToken: result.accessToken,
      token: result.accessToken,
      user: result.user,
    },
  });
});

const logout = catchAsync(async (req: Request, res: Response) => {
  tokenUtils.clearAuthCookies(res, req);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Logged out successfully",
  });
});

const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.googleAuth(req.body);

  tokenUtils.setAccessTokenCookie(res, result.accessToken, req);
  tokenUtils.setRefreshTokenCookie(res, result.refreshToken, req);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Google login successful",
    token: result.accessToken,
    user: result.user,
    data: {
      accessToken: result.accessToken,
      token: result.accessToken,
      user: result.user,
    },
  });
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const incomingRefreshToken = req.cookies?.refreshToken;
  const result = await authService.getNewToken(incomingRefreshToken);

  tokenUtils.setAccessTokenCookie(res, result.accessToken, req);
  tokenUtils.setRefreshTokenCookie(res, result.refreshToken, req);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Access token refreshed successfully",
    data: {
      accessToken: result.accessToken,
    },
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(status.UNAUTHORIZED, "Unauthorized access");
  }

  const result = await authService.getMe(userId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "User profile fetched successfully",
    data: result,
  });
});

export const authController = {
  signup,
  login,
  logout,
  googleAuth,
  refreshToken,
  getMe,
};
