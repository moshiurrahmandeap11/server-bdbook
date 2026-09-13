import { Router } from "express";
import { authRoutes } from "../module/auth/auth.route";
import { friendRoutes } from "../module/friend/friend.route";
import { messageRoutes } from "../module/message/message.route";
import { notificationRoutes } from "../module/notification/notification.route";
import { postRoutes } from "../module/post/post.route";
import { userRoutes } from "../module/user/user.route";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/posts", postRoutes);
router.use("/notifications", notificationRoutes);
router.use("/friends", friendRoutes);
router.use("/messages", messageRoutes);

export const IndexRoutes = router;

