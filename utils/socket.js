// socket.js
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { Server } from "socket.io";
import { db } from "../database/db.js";


class SocketManager {
  constructor(server) {
    this.io = null;
    this.onlineUsers = new Map();
    this.initialize(server);
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: ['https://client-bdbook.vercel.app','http://localhost:3000', 'http://localhost:5173'],
        credentials: true
      }
    });

    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      console.log("Socket auth token:", token ? "Present" : "Missing");
      
      if (!token) {
        return next(new Error("Authentication error"));
      }
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        console.log("Socket authenticated for user:", socket.userId);
        next();
      } catch (err) {
        console.error("Socket auth error:", err.message);
        next(new Error("Invalid token"));
      }
    });

    this.io.on("connection", this.handleConnection.bind(this));
    console.log("Socket.io initialized");
  }

  // Handle new connection
  handleConnection(socket) {
    console.log("User connected:", socket.userId);
    
    // Add user to online users
    this.onlineUsers.set(socket.userId, socket.id);
    this.io.emit("user_online", Array.from(this.onlineUsers.keys()));
    
    // Handle join room (for private chat)
    socket.on("join_room", (friendId) => {
      const room = [socket.userId, friendId].sort().join("_");
      socket.join(room);
      console.log(`User ${socket.userId} joined room ${room}`);
    });
    
    // Handle leave room
    socket.on("leave_room", (friendId) => {
      const room = [socket.userId, friendId].sort().join("_");
      socket.leave(room);
      console.log(`User ${socket.userId} left room ${room}`);
    });
    
    // Handle sending message
    socket.on("send_message", async (data) => {
      await this.handleSendMessage(socket, data);
    });
    
    // Handle typing indicator
    socket.on("typing", ({ receiverId, isTyping }) => {
      this.handleTyping(socket, receiverId, isTyping);
    });
    
    // Handle mark as read
    socket.on("mark_as_read", async ({ senderId }) => {
      await this.handleMarkAsRead(socket, senderId);
    });
    
    // ==================== CALL EVENT HANDLERS ====================
    
    // Handle call user (initiate call)
    socket.on("call_user", async (data) => {
      const { to, from, fromName, type, offer } = data;
      
      console.log(`📞 Call from ${from} to ${to}, type: ${type}`);
      console.log(`Offer SDP:`, offer ? "Present" : "Missing");
      
      // Store call info for this socket
      socket.callInfo = { from, fromName, type, offer, to };
      
      // Check if target user is online
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        // Check if target is already in a call
        const targetSocket = this.io.sockets.sockets.get(targetSocketId);
        if (targetSocket && targetSocket.callInfo) {
          socket.emit("call_busy", { message: "User is on another call" });
          console.log(`❌ User ${to} is busy`);
          return;
        }
        
        this.io.to(targetSocketId).emit("incoming_call", {
          from: from,
          fromName: fromName,
          type: type,
          offer: offer
        });
        console.log(`✅ Incoming call sent to ${to}`);
      } else {
        socket.emit("call_error", { message: "User is offline" });
        console.log(`❌ User ${to} is offline`);
      }
    });
    
    // Handle answer call (accept call)
    socket.on("answer_call", (data) => {
      const { to, answer } = data;
      
      console.log(`📞 Call answered from ${socket.userId} to ${to}`);
      console.log(`Answer SDP:`, answer ? "Present" : "Missing");
      
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_accepted", { answer });
        console.log(`✅ Call accepted sent to ${to}`);
      } else {
        socket.emit("call_error", { message: "User disconnected" });
        console.log(`❌ Target ${to} not found`);
      }
    });
    
    // Handle reject call
    socket.on("reject_call", (data) => {
      const { to } = data;
      
      console.log(`📞 Call rejected from ${socket.userId} to ${to}`);
      
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_rejected");
        console.log(`✅ Call rejected sent to ${to}`);
      }
    });
    
    // Handle end call
    socket.on("end_call", (data) => {
      const { to } = data;
      
      console.log(`📞 Call ended from ${socket.userId} to ${to}`);
      
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_ended");
        console.log(`✅ Call ended sent to ${to}`);
      }
      
      // Clear call info
      delete socket.callInfo;
    });
    
    // Handle ICE candidate for WebRTC
    socket.on("ice_candidate", (data) => {
      const { to, candidate } = data;
      
      console.log(`🔧 ICE candidate from ${socket.userId} to ${to}`);
      
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("ice_candidate", { candidate });
        console.log(`✅ ICE candidate forwarded to ${to}`);
      }
    });
    
    // Handle call busy
    socket.on("call_busy", (data) => {
      const { to } = data;
      
      console.log(`📞 Call busy from ${socket.userId} to ${to}`);
      
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_busy");
        console.log(`✅ Call busy sent to ${to}`);
      }
    });
    
    // Handle call error
    socket.on("call_error", (data) => {
      const { to, message } = data;
      
      console.log(`❌ Call error from ${socket.userId}: ${message}`);
      
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_error", { message });
      }
    });
    
    // Handle disconnect
    socket.on("disconnect", () => {
      this.handleDisconnect(socket);
    });
  }

  // Send message handler
  async handleSendMessage(socket, data) {
    const { receiverId, message, messageType = "text", mediaUrl = null, fileName = null, fileSize = null, tempId } = data;
    
    try {
      // Get sender info
      const sender = await db.collection("users").findOne(
        { _id: new ObjectId(socket.userId) },
        { projection: { fullName: 1, profilePicture: 1 } }
      );
      
      const messageData = {
        _id: new ObjectId(),
        senderId: socket.userId,
        senderName: sender?.fullName || "User",
        senderProfilePicture: sender?.profilePicture?.url || null,
        receiverId: receiverId,
        message: message || "",
        messageType: messageType,
        mediaUrl: mediaUrl,
        fileName: fileName,
        fileSize: fileSize,
        isRead: false,
        isDelivered: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tempId: tempId || null
      };
        
      // Store in database
      await db.collection("messages").insertOne(messageData);
      
      // Update or create conversation for sender
      await db.collection("conversations").updateOne(
        {
          userId: socket.userId,
          friendId: receiverId
        },
        {
          $set: {
            lastMessage: message || (messageType === "image" ? "📷 Photo" : messageType === "video" ? "📹 Video" : "📎 File"),
            lastMessageTime: new Date(),
            updatedAt: new Date()
          },
          $setOnInsert: {
            userId: socket.userId,
            friendId: receiverId,
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
      
      // Update or create conversation for receiver
      await db.collection("conversations").updateOne(
        {
          userId: receiverId,
          friendId: socket.userId
        },
        {
          $set: {
            lastMessage: message || (messageType === "image" ? "📷 Photo" : messageType === "video" ? "📹 Video" : "📎 File"),
            lastMessageTime: new Date(),
            updatedAt: new Date()
          },
          $setOnInsert: {
            userId: receiverId,
            friendId: socket.userId,
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
      
      // Emit to receiver if online
      const receiverSocketId = this.onlineUsers.get(receiverId);
      if (receiverSocketId) {
        this.io.to(receiverSocketId).emit("receive_message", messageData);
        console.log(`Message sent to ${receiverId}`);
      }
      
      // Emit back to sender
      socket.emit("message_sent", messageData);
      
    } catch (error) {
      console.error("Send message error:", error);
      socket.emit("message_error", { 
        tempId: tempId, 
        error: error.message 
      });
    }
  }

  // Typing indicator handler
  handleTyping(socket, receiverId, isTyping) {
    const receiverSocketId = this.onlineUsers.get(receiverId);
    if (receiverSocketId) {
      this.io.to(receiverSocketId).emit("user_typing", {
        userId: socket.userId,
        isTyping
      });
    }
  }

  // Mark as read handler
  async handleMarkAsRead(socket, senderId) {
    try {
      const result = await db.collection("messages").updateMany(
        {
          senderId: senderId,
          receiverId: socket.userId,
          isRead: false
        },
        {
          $set: { isRead: true, updatedAt: new Date() }
        }
      );
      
      console.log(`Marked ${result.modifiedCount} messages as read from ${senderId}`);
      
      const senderSocketId = this.onlineUsers.get(senderId);
      if (senderSocketId) {
        this.io.to(senderSocketId).emit("messages_read", { userId: socket.userId });
      }
    } catch (error) {
      console.error("Mark as read error:", error);
    }
  }

  // Disconnect handler
  handleDisconnect(socket) {
    // Remove user from online users
    this.onlineUsers.delete(socket.userId);
    
    // Clear call info if exists
    if (socket.callInfo) {
      const { to } = socket.callInfo;
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_ended");
      }
      delete socket.callInfo;
    }
    
    // Notify others that user is offline
    this.io.emit("user_offline", socket.userId);
    console.log("User disconnected:", socket.userId);
    console.log("Online users:", Array.from(this.onlineUsers.keys()));
  }

  // ==================== NOTIFICATION METHODS ====================
  
  // Create and send notification
  async createNotification(userId, type, data) {
    try {
      const notification = {
        _id: new ObjectId(),
        userId: userId,
        type: type, // 'friend_request', 'friend_accept', 'post_like', 'post_comment', 'post_share', 'message'
        data: data,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.collection("notifications").insertOne(notification);
      
      // Send real-time notification via socket
      this.sendNotification(userId, notification);
      
      return notification;
    } catch (error) {
      console.error("Create notification error:", error);
      return null;
    }
  }

  // Send notification to specific user
  sendNotification(userId, notification) {
    const userSocketId = this.onlineUsers.get(userId);
    if (userSocketId) {
      this.io.to(userSocketId).emit("new_notification", notification);
      console.log(`Notification sent to user ${userId}:`, notification.type);
    }
  }

  // Send multiple notifications
  async sendBulkNotifications(users, type, data) {
    const notifications = [];
    for (const userId of users) {
      const notification = await this.createNotification(userId, type, data);
      if (notification) notifications.push(notification);
    }
    return notifications;
  }

  // Get online users
  getOnlineUsers() {
    return Array.from(this.onlineUsers.keys());
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }

  // Get socket instance
  getIO() {
    return this.io;
  }
}

// Singleton instance
let socketManager = null;

export const initializeSocket = (server) => {
  if (!socketManager) {
    socketManager = new SocketManager(server);
  }
  return socketManager;
};

export const getSocketManager = () => {
  if (!socketManager) {
    throw new Error("Socket not initialized. Call initializeSocket first.");
  }
  return socketManager;
};

export default { initializeSocket, getSocketManager };