import { Request, Response } from "express";
import status from "http-status";
import { env } from "../../config/env";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { authService } from "./auth.service";

const signup = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.signup(req.body);

    res.status(200).json({ success: true });
};

export const authController = {
  register,
  login,
  getMe,
  changePassword,
  logout,
  googleAuth,
};
