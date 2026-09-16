import status from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { userService } from "./user.service.js";
const getMe = catchAsync(async (req, res) => {
    const result = await userService.getMe(req.user.id);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User fetched successfully",
        data: result,
    });
});
const getAllUsers = catchAsync(async (req, res) => {
    const filters = { search: req.query.search };
    const pagination = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
    };
    const result = await userService.getAllUsers(filters, pagination);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Users fetched successfully",
        data: result.data,
        meta: result.meta,
    });
});
const getUserById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await userService.getUserById(id);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User fetched successfully",
        data: result,
    });
});
const getUserByEmail = catchAsync(async (req, res) => {
    const { email } = req.params;
    const result = await userService.getUserByEmail(email);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User fetched successfully",
        data: result,
    });
});
const searchUsers = catchAsync(async (req, res) => {
    const { query } = req.params;
    const limit = Number(req.query.limit) || 20;
    const result = await userService.searchUsers(query, limit);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Users found",
        data: result,
        count: result.length,
    });
});
const updateUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await userService.updateUser(req.user.id, id, req.user.role, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User updated successfully",
        data: result,
    });
});
const uploadProfilePicture = catchAsync(async (req, res) => {
    const result = await userService.uploadProfilePicture(req.user.id, req.file);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Profile picture uploaded successfully",
        data: result,
    });
});
const removeProfilePicture = catchAsync(async (req, res) => {
    await userService.removeProfilePicture(req.user.id);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Profile picture removed successfully",
    });
});
const uploadCoverPhoto = catchAsync(async (req, res) => {
    const result = await userService.uploadCoverPhoto(req.user.id, req.file);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Cover photo uploaded successfully",
        data: result,
    });
});
const removeCoverPhoto = catchAsync(async (req, res) => {
    await userService.removeCoverPhoto(req.user.id);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Cover photo removed successfully",
    });
});
const changePassword = catchAsync(async (req, res) => {
    await userService.changePassword(req.user.id, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Password changed successfully",
    });
});
const deleteUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    await userService.deleteUser(req.user.id, id, req.user.role);
    if (req.user.id === id) {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
        });
    }
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "User account deleted successfully",
    });
});
export const userController = {
    getMe,
    getAllUsers,
    getUserById,
    getUserByEmail,
    searchUsers,
    updateUser,
    uploadProfilePicture,
    removeProfilePicture,
    uploadCoverPhoto,
    removeCoverPhoto,
    changePassword,
    deleteUser,
};
