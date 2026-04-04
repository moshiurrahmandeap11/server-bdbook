// notificationRoutes.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { db } from "../../database/db.js";
import { getSocketManager } from "../../utils/socket.js";


const router = Router();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided."
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
};

// ==================== CREATE NOTIFICATION ====================
export const createNotification = async (userId, type, data) => {
  try {
    const socketManager = getSocketManager();
    const notification = await socketManager.createNotification(userId, type, data);
    return notification;
  } catch (error) {
    console.error("Create notification error:", error);
    return null;
  }
};

// ==================== GET USER NOTIFICATIONS ====================
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    const notifications = await db.collection("notifications")
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();
    
    const unreadCount = await db.collection("notifications")
      .countDocuments({ userId: userId, isRead: false });
    
    const total = await db.collection("notifications")
      .countDocuments({ userId: userId });
    
    res.json({
      success: true,
      data: notifications,
      unreadCount: unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get notifications"
    });
  }
});

// ==================== MARK NOTIFICATION AS READ ====================
router.patch("/:notificationId/read", authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;
    
    if (!ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID format"
      });
    }
    
    const result = await db.collection("notifications").updateOne(
      { _id: new ObjectId(notificationId), userId: userId },
      { $set: { isRead: true, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }
    
    res.json({
      success: true,
      message: "Notification marked as read"
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read"
    });
  }
});

// ==================== MARK ALL NOTIFICATIONS AS READ ====================
router.patch("/read-all", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    await db.collection("notifications").updateMany(
      { userId: userId, isRead: false },
      { $set: { isRead: true, updatedAt: new Date() } }
    );
    
    res.json({
      success: true,
      message: "All notifications marked as read"
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all as read"
    });
  }
});

// ==================== DELETE NOTIFICATION ====================
router.delete("/:notificationId", authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;
    
    if (!ObjectId.isValid(notificationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID format"
      });
    }
    
    const result = await db.collection("notifications").deleteOne({
      _id: new ObjectId(notificationId),
      userId: userId
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }
    
    res.json({
      success: true,
      message: "Notification deleted successfully"
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification"
    });
  }
});

// ==================== GET UNREAD COUNT ====================
router.get("/unread/count", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const unreadCount = await db.collection("notifications")
      .countDocuments({ userId: userId, isRead: false });
    
    res.json({
      success: true,
      unreadCount: unreadCount
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get unread count"
    });
  }
});

export default router;