import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { messageService } from "./message.service";

const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const { receiverId } = req.params;
  const result = await messageService.sendMessage(
    req.user!.id,
    receiverId,
    req.body
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
});

const getConversations = catchAsync(async (req: Request, res: Response) => {
  const result = await messageService.getConversations(req.user!.id);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Conversations fetched successfully",
    data: result,
  });
});

const getMessages = catchAsync(async (req: Request, res: Response) => {
  const { friendId } = req.params;
  const result = await messageService.getMessages(req.user!.id, friendId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Messages fetched successfully",
    data: result,
  });
});

const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const { senderId } = req.params;
  await messageService.markAsRead(req.user!.id, senderId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Messages marked as read",
  });
});

const getUnreadCount = catchAsync(async (req: Request, res: Response) => {
  const result = await messageService.getUnreadCount(req.user!.id);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Unread count fetched successfully",
    count: result.count,
    data: result,
  });
});

const uploadMessageMedia = catchAsync(async (req: Request, res: Response) => {
  const result = await messageService.uploadMessageMedia(
    req.file as Express.Multer.File
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Media uploaded successfully",
    data: result,
  });
});

const createGroup = catchAsync(async (req: Request, res: Response) => {
  const result = await messageService.createGroup(req.user!.id, req.body);

  sendResponse(res, {
    httpStatusCode: status.CREATED,
    success: true,
    message: "Group created successfully",
    data: result,
  });
});

const toggleReaction = catchAsync(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const { reaction } = req.body;
  const result = await messageService.toggleReaction(
    req.user!.id,
    messageId,
    reaction
  );

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Reaction updated",
    data: result,
  });
});

const acceptMessageRequest = catchAsync(async (req: Request, res: Response) => {
  const { partnerId } = req.params;
  await messageService.acceptMessageRequest(req.user!.id, partnerId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Message request accepted",
  });
});

const declineMessageRequest = catchAsync(async (req: Request, res: Response) => {
  const { partnerId } = req.params;
  await messageService.declineMessageRequest(req.user!.id, partnerId);

  sendResponse(res, {
    httpStatusCode: status.OK,
    success: true,
    message: "Message request declined",
  });
});

export const messageController = {
  sendMessage,
  getConversations,
  getMessages,
  markAsRead,
  getUnreadCount,
  uploadMessageMedia,
  createGroup,
  toggleReaction,
  acceptMessageRequest,
  declineMessageRequest,
};
