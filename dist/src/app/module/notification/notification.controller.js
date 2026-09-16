import status from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { notificationService } from "./notification.service.js";
const getUserNotifications = catchAsync(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await notificationService.getUserNotifications(req.user.id, page, limit);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Notifications fetched successfully",
        data: result.data,
        meta: result.meta,
        unreadCount: result.unreadCount,
    });
});
const markAsRead = catchAsync(async (req, res) => {
    const { notificationId } = req.params;
    await notificationService.markAsRead(req.user.id, notificationId);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Notification marked as read",
    });
});
const markAllAsRead = catchAsync(async (req, res) => {
    await notificationService.markAllAsRead(req.user.id);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "All notifications marked as read",
    });
});
const deleteNotification = catchAsync(async (req, res) => {
    const { notificationId } = req.params;
    await notificationService.deleteNotification(req.user.id, notificationId);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Notification deleted successfully",
    });
});
const getUnreadCount = catchAsync(async (req, res) => {
    const result = await notificationService.getUnreadCount(req.user.id);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Unread count fetched successfully",
        unreadCount: result.unreadCount,
        data: result,
    });
});
export const notificationController = {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getUnreadCount,
};
