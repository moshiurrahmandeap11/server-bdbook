import { Router } from "express";
import { auth } from "../../middleware/auth";
import { messageMediaUpload } from "../../middleware/upload";
import { validateRequest } from "../../middleware/validateRequest";
import { messageController } from "./message.controller";
import { messageValidation } from "./message.validation";

const router = Router();

router.post(
  "/send-message/:receiverId",
  auth(),
  validateRequest(messageValidation.sendMessageValidationSchema),
  messageController.sendMessage
);

router.get("/conversations", auth(), messageController.getConversations);
router.get("/messages/:friendId", auth(), messageController.getMessages);
router.patch("/messages/read/:senderId", auth(), messageController.markAsRead);
router.get("/unread-messages/count", auth(), messageController.getUnreadCount);

router.post(
  "/upload-message-media",
  auth(),
  messageMediaUpload.single("file"),
  messageController.uploadMessageMedia
);

export const messageRoutes = router;

