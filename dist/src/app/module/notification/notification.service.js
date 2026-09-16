import status from "http-status";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
// Delegate socket emission to avoid circular dependencies
let emitNotificationCallback = null;
export const setNotificationSocketEmitter = (callback) => {
    emitNotificationCallback = callback;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formatNotification = (n) => {
    return {
        _id: n.id,
        id: n.id,
        userId: n.userId,
        actorId: n.actorId,
        type: n.type,
        title: n.title,
        message: n.message,
        postId: n.postId,
        commentId: n.commentId,
        requestId: n.requestId,
        isRead: n.isRead,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        actor: n.actor
            ? {
                id: n.actor.id,
                fullName: n.actor.fullName,
                profilePicUrl: n.actor.profilePicUrl,
            }
            : null,
        data: {
            postId: n.postId,
            commentId: n.commentId,
            requestId: n.requestId,
            actorId: n.actorId,
            actorName: n.actor?.fullName || null,
            actorProfilePicture: n.actor?.profilePicUrl || null,
            message: n.message,
        },
    };
};
const createNotification = async (input) => {
    const notification = await prisma.notification.create({
        data: {
            userId: input.userId,
            actorId: input.actorId || null,
            type: input.type,
            title: input.title || null,
            message: input.message,
            postId: input.postId || null,
            commentId: input.commentId || null,
            requestId: input.requestId || null,
            isRead: false,
        },
        include: {
            actor: {
                select: {
                    id: true,
                    fullName: true,
                    profilePicUrl: true,
                },
            },
        },
    });
    const formatted = formatNotification(notification);
    if (emitNotificationCallback) {
        try {
            emitNotificationCallback(input.userId, formatted);
        }
        catch {
            // Non-blocking
        }
    }
    return formatted;
};
const getUserNotifications = async (userId, page = 1, limit = 20) => {
    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where: { userId },
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                actor: {
                    select: {
                        id: true,
                        fullName: true,
                        profilePicUrl: true,
                    },
                },
            },
        }),
        prisma.notification.count({ where: { userId } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: notifications.map(formatNotification),
        unreadCount,
    };
};
const markAsRead = async (userId, notificationId) => {
    const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
    });
    if (!notification || notification.userId !== userId) {
        throw new AppError(status.NOT_FOUND, "Notification not found");
    }
    await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
    });
};
const markAllAsRead = async (userId) => {
    await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
    });
};
const deleteNotification = async (userId, notificationId) => {
    const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
    });
    if (!notification || notification.userId !== userId) {
        throw new AppError(status.NOT_FOUND, "Notification not found");
    }
    await prisma.notification.delete({
        where: { id: notificationId },
    });
};
const getUnreadCount = async (userId) => {
    const count = await prisma.notification.count({
        where: { userId, isRead: false },
    });
    return { unreadCount: count };
};
export const notificationService = {
    createNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getUnreadCount,
};
