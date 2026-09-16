import status from "http-status";
import { env } from "../../config/env.js";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { authService } from "./auth.service.js";
const signup = catchAsync(async (req, res) => {
    const result = await authService.signup(req.body);
    sendResponse(res, {
        httpStatusCode: status.CREATED,
        success: true,
        message: "Account created successfully",
        data: result,
    });
});
const login = catchAsync(async (req, res) => {
    const result = await authService.login(req.body);
    res.cookie("token", result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
    });
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Login successful",
        token: result.token,
        user: result.user,
        data: {
            token: result.token,
            user: result.user,
        },
    });
});
const logout = catchAsync(async (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
    });
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Logged out successfully",
    });
});
export const authController = {
    signup,
    login,
    logout,
};
