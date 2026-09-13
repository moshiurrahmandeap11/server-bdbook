import { Router } from "express";
import { auth } from "../../middleware/auth";
import { notificationController } from "./notification.controller";

const router = Router();

router.get("/", auth(), notificationController.getUserNotifications);
router.patch("/:notificationId/read", auth(), notificationController.markAsRead);
router.patch("/read-all", auth(), notificationController.markAllAsRead);
router.delete("/:notificationId", auth(), notificationController.deleteNotification);
router.get("/unread/count", auth(), notificationController.getUnreadCount);
router.get("/unread-count", auth(), notificationController.getUnreadCount);

export const notificationRoutes = router;

