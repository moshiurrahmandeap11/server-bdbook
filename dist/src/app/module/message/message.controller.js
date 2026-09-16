import status from "http-status";
import { catchAsync } from "../../shared/catchAsync.js";
import { sendResponse } from "../../shared/sendResponse.js";
import { messageService } from "./message.service.js";
const sendMessage = catchAsync(async (req, res) => {
    const { receiverId } = req.params;
    const result = await messageService.sendMessage(req.user.id, receiverId, req.body);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Message sent successfully",
        data: result,
    });
});
const getConversations = catchAsync(async (req, res) => {
    const result = await messageService.getConversations(req.user.id);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Conversations fetched successfully",
        data: result,
    });
});
const getMessages = catchAsync(async (req, res) => {
    const { friendId } = req.params;
    const result = await messageService.getMessages(req.user.id, friendId);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Messages fetched successfully",
        data: result,
    });
});
const markAsRead = catchAsync(async (req, res) => {
    const { senderId } = req.params;
    await messageService.markAsRead(req.user.id, senderId);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Messages marked as read",
    });
});
const getUnreadCount = catchAsync(async (req, res) => {
    const result = await messageService.getUnreadCount(req.user.id);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Unread count fetched successfully",
        count: result.count,
        data: result,
    });
});
const uploadMessageMedia = catchAsync(async (req, res) => {
    const result = await messageService.uploadMessageMedia(req.file);
    sendResponse(res, {
        httpStatusCode: status.OK,
        success: true,
        message: "Media uploaded successfully",
        data: result,
    });
});
export const messageController = {
    sendMessage,
    getConversations,
    getMessages,
    markAsRead,
    getUnreadCount,
    uploadMessageMedia,
};
