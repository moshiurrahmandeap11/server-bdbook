// socket.js
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import { Server } from "socket.io";
import { db } from "../database/db.js";

class SocketManager {
  constructor(server) {
    this.io = null;
    this.onlineUsers = new Map();
    this.rooms = new Map();
    this.initialize(server);
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          "https://client-bdbook.vercel.app",
          "http://localhost:3000",
          "http://localhost:5173",
        ],
        credentials: true,
      },
    });

    // ✅ FIXED: Guest দের allow করো, শুধু invalid token এ block করো না
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        // token নেই = guest user, allow করো
        socket.userId = `guest_${Math.random().toString(36).substring(2, 10)}`;
        socket.isGuest = true;
        console.log("Guest socket connected:", socket.userId);
        return next();
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.isGuest = false;
        console.log("Authenticated socket connected:", socket.userId);
        next();
      } catch (err) {
        // ✅ Invalid token হলেও guest হিসেবে allow করো, reject করো না
        socket.userId = `guest_${Math.random().toString(36).substring(2, 10)}`;
        socket.isGuest = true;
        console.log("Invalid token, connected as guest:", socket.userId);
        next();
      }
    });

    this.io.on("connection", this.handleConnection.bind(this));
    console.log("Socket.io initialized");
  }

  handleConnection(socket) {
    console.log("User connected:", socket.userId, socket.isGuest ? "(guest)" : "(auth)");

    this.onlineUsers.set(socket.userId, socket.id);
    this.io.emit("user_online", Array.from(this.onlineUsers.keys()));

    // ==================== ROOM EVENT HANDLERS ====================

    socket.on("create_room", async (data) => {
      const { roomId, roomName, userId, userName, userProfilePicture } = data;

      // ✅ client থেকে আসা userId use করো (guest এর জন্য)
      const effectiveUserId = userId || socket.userId;

      console.log(`🏠 Creating room: ${roomId} by ${userName}`);

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = effectiveUserId;
      socket.userName = userName;
      socket.userProfilePicture = userProfilePicture;

      this.rooms.set(roomId, {
        id: roomId,
        name: roomName,
        createdBy: effectiveUserId,
        createdAt: new Date(),
        participants: [
          {
            userId: effectiveUserId,
            userName: userName,
            userProfilePicture: userProfilePicture,
          },
        ],
      });

      socket.emit("room_created", {
        roomId,
        roomName,
        createdBy: effectiveUserId,
      });

      console.log(`✅ Room created: ${roomId}`);
    });

socket.on("join_room", async (data) => {
  const { roomId, userId, userName, userProfilePicture } = data;
  
  // ✅ গুরুত্বপূর্ণ: userId যদি না আসে তাহলে socket.userId ব্যবহার করো
  const effectiveUserId = userId || socket.userId;
  const effectiveUserName = userName || socket.userName || "Guest";
  
  console.log(`🚪 User ${effectiveUserName} (${effectiveUserId}) joining room: ${roomId}`);

  // Check if room exists
  if (!this.rooms || !this.rooms.has(roomId)) {
    console.log(`❌ Room ${roomId} not found`);
    socket.emit("room_error", { message: "Room not found. Please check the meeting ID." });
    return;
  }

  const room = this.rooms.get(roomId);
  
  // Join the socket room
  socket.join(roomId);
  socket.roomId = roomId;
  socket.userId = effectiveUserId;
  socket.userName = effectiveUserName;
  socket.userProfilePicture = userProfilePicture;
  
  // Add to participants list if not already there
  const existingParticipant = room.participants.find(p => p.userId === effectiveUserId);
  if (!existingParticipant) {
    room.participants.push({
      userId: effectiveUserId,
      userName: effectiveUserName,
      userProfilePicture: userProfilePicture,
    });
  }
  
  // Get other participants (excluding current user)
  const otherParticipants = room.participants.filter(p => p.userId !== effectiveUserId);
  
  console.log(`📋 Room ${roomId} now has ${room.participants.length} participants`);
  
  // ✅ Send room info to the joining user
  socket.emit("room_joined", {
    roomId,
    roomName: room.name,
    participants: otherParticipants,
  });
  
  // ✅ Notify other participants about the new user
  socket.to(roomId).emit("new_participant", {
    userId: effectiveUserId,
    userName: effectiveUserName,
    userProfilePicture: userProfilePicture,
  });
  
  console.log(`✅ User ${effectiveUserName} successfully joined room ${roomId}`);
});

    socket.on("offer", (data) => {
      const { roomId, to, offer } = data;
      console.log(`📡 Offer from ${socket.userId} to ${to}`);

      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("offer", {
          from: socket.userId,
          offer: offer,
        });
        console.log(`✅ Offer forwarded to ${to}`);
      } else {
        console.log(`❌ Target ${to} not found in onlineUsers`);
      }
    });

    socket.on("answer", (data) => {
      const { roomId, to, answer } = data;
      console.log(`📡 Answer from ${socket.userId} to ${to}`);

      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("answer", {
          from: socket.userId,
          answer: answer,
        });
        console.log(`✅ Answer forwarded to ${to}`);
      } else {
        console.log(`❌ Target ${to} not found`);
      }
    });

    socket.on("ice_candidate", (data) => {
      const { roomId, to, candidate } = data;

      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("ice_candidate", {
          from: socket.userId,
          candidate: candidate,
        });
      }
    });

    socket.on("send_room_message", (data) => {
      const { roomId, message, userId, userName, userProfilePicture } = data;

      console.log(`💬 Message in room ${roomId} from ${userName}`);

      this.io.to(roomId).emit("room_message", {
        userId,
        userName,
        userProfilePicture,
        message,
        timestamp: new Date(),
      });
    });

    socket.on("leave_room", (data) => {
      const { roomId } = data;

      console.log(`🚪 User ${socket.userName} leaving room ${roomId}`);

      if (roomId && this.rooms && this.rooms.has(roomId)) {
        const room = this.rooms.get(roomId);

        room.participants = room.participants.filter(
          (p) => p.userId !== socket.userId
        );

        socket.to(roomId).emit("participant_left", {
          userId: socket.userId,
          userName: socket.userName,
        });

        socket.leave(roomId);

        if (room.participants.length === 0) {
          this.rooms.delete(roomId);
          console.log(`🗑️ Room ${roomId} deleted (empty)`);
        }
      }

      delete socket.roomId;
    });

    // ==================== PRIVATE CHAT EVENT HANDLERS ====================

    socket.on("join_private_room", (friendId) => {
      const room = [socket.userId, friendId].sort().join("_");
      socket.join(room);
      console.log(`User ${socket.userId} joined private room ${room}`);
    });

    socket.on("leave_private_room", (friendId) => {
      const room = [socket.userId, friendId].sort().join("_");
      socket.leave(room);
      console.log(`User ${socket.userId} left private room ${room}`);
    });

    socket.on("send_message", async (data) => {
      await this.handleSendMessage(socket, data);
    });

    socket.on("typing", ({ receiverId, isTyping }) => {
      this.handleTyping(socket, receiverId, isTyping);
    });

    socket.on("mark_as_read", async ({ senderId }) => {
      await this.handleMarkAsRead(socket, senderId);
    });

    // ==================== CALL EVENT HANDLERS ====================

    socket.on("call_user", async (data) => {
      const { to, from, fromName, type, offer } = data;

      console.log(`📞 Call from ${from} to ${to}, type: ${type}`);

      socket.callInfo = { from, fromName, type, offer, to };

      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        const targetSocket = this.io.sockets.sockets.get(targetSocketId);
        if (targetSocket && targetSocket.callInfo) {
          socket.emit("call_busy", { message: "User is on another call" });
          return;
        }

        this.io.to(targetSocketId).emit("incoming_call", {
          from,
          fromName,
          type,
          offer,
        });
        console.log(`✅ Incoming call sent to ${to}`);
      } else {
        socket.emit("call_error", { message: "User is offline" });
      }
    });

    socket.on("answer_call", (data) => {
      const { to, answer } = data;

      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_accepted", { answer });
      } else {
        socket.emit("call_error", { message: "User disconnected" });
      }
    });

    socket.on("reject_call", (data) => {
      const { to } = data;
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_rejected");
      }
    });

    socket.on("end_call", (data) => {
      const { to } = data;
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_ended");
      }
      delete socket.callInfo;
    });

    socket.on("call_busy", (data) => {
      const { to } = data;
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_busy");
      }
    });

    socket.on("call_error", (data) => {
      const { to, message } = data;
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_error", { message });
      }
    });

    socket.on("disconnect", () => {
      this.handleDisconnect(socket);
    });
  }

  async handleSendMessage(socket, data) {
    const {
      receiverId,
      message,
      messageType = "text",
      mediaUrl = null,
      fileName = null,
      fileSize = null,
      tempId,
    } = data;

    // ✅ Guest user রা message পাঠাতে পারবে না
    if (socket.isGuest) {
      socket.emit("message_error", { tempId, error: "Login required to send messages" });
      return;
    }

    try {
      const sender = await db.collection("users").findOne(
        { _id: new ObjectId(socket.userId) },
        { projection: { fullName: 1, profilePicture: 1 } }
      );

      const messageData = {
        _id: new ObjectId(),
        senderId: socket.userId,
        senderName: sender?.fullName || "User",
        senderProfilePicture: sender?.profilePicture?.url || null,
        receiverId,
        message: message || "",
        messageType,
        mediaUrl,
        fileName,
        fileSize,
        isRead: false,
        isDelivered: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        tempId: tempId || null,
      };

      await db.collection("messages").insertOne(messageData);

      await db.collection("conversations").updateOne(
        { userId: socket.userId, friendId: receiverId },
        {
          $set: {
            lastMessage:
              message ||
              (messageType === "image"
                ? "📷 Photo"
                : messageType === "video"
                ? "📹 Video"
                : "📎 File"),
            lastMessageTime: new Date(),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            userId: socket.userId,
            friendId: receiverId,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      await db.collection("conversations").updateOne(
        { userId: receiverId, friendId: socket.userId },
        {
          $set: {
            lastMessage:
              message ||
              (messageType === "image"
                ? "📷 Photo"
                : messageType === "video"
                ? "📹 Video"
                : "📎 File"),
            lastMessageTime: new Date(),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            userId: receiverId,
            friendId: socket.userId,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      const receiverSocketId = this.onlineUsers.get(receiverId);
      if (receiverSocketId) {
        this.io.to(receiverSocketId).emit("receive_message", messageData);
      }

      socket.emit("message_sent", messageData);
    } catch (error) {
      console.error("Send message error:", error);
      socket.emit("message_error", { tempId, error: error.message });
    }
  }

  handleTyping(socket, receiverId, isTyping) {
    const receiverSocketId = this.onlineUsers.get(receiverId);
    if (receiverSocketId) {
      this.io.to(receiverSocketId).emit("user_typing", {
        userId: socket.userId,
        isTyping,
      });
    }
  }

  async handleMarkAsRead(socket, senderId) {
    if (socket.isGuest) return;

    try {
      const result = await db.collection("messages").updateMany(
        { senderId, receiverId: socket.userId, isRead: false },
        { $set: { isRead: true, updatedAt: new Date() } }
      );

      const senderSocketId = this.onlineUsers.get(senderId);
      if (senderSocketId) {
        this.io.to(senderSocketId).emit("messages_read", {
          userId: socket.userId,
        });
      }
    } catch (error) {
      console.error("Mark as read error:", error);
    }
  }

  handleDisconnect(socket) {
    if (socket.roomId && this.rooms && this.rooms.has(socket.roomId)) {
      const room = this.rooms.get(socket.roomId);

      room.participants = room.participants.filter(
        (p) => p.userId !== socket.userId
      );

      socket.to(socket.roomId).emit("participant_left", {
        userId: socket.userId,
        userName: socket.userName,
      });

      if (room.participants.length === 0) {
        this.rooms.delete(socket.roomId);
        console.log(`🗑️ Room ${socket.roomId} deleted (empty)`);
      }
    }

    this.onlineUsers.delete(socket.userId);

    if (socket.callInfo) {
      const { to } = socket.callInfo;
      const targetSocketId = this.onlineUsers.get(to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_ended");
      }
      delete socket.callInfo;
    }

    this.io.emit("user_offline", socket.userId);
    console.log("User disconnected:", socket.userId);
  }

  // ==================== NOTIFICATION METHODS ====================

  async createNotification(userId, type, data) {
    try {
      const notification = {
        _id: new ObjectId(),
        userId,
        type,
        data,
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection("notifications").insertOne(notification);
      this.sendNotification(userId, notification);
      return notification;
    } catch (error) {
      console.error("Create notification error:", error);
      return null;
    }
  }

  sendNotification(userId, notification) {
    const userSocketId = this.onlineUsers.get(userId);
    if (userSocketId) {
      this.io.to(userSocketId).emit("new_notification", notification);
    }
  }

  async sendBulkNotifications(users, type, data) {
    const notifications = [];
    for (const userId of users) {
      const notification = await this.createNotification(userId, type, data);
      if (notification) notifications.push(notification);
    }
    return notifications;
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers.keys());
  }

  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  getRoomParticipants(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.participants : [];
  }

  getIO() {
    return this.io;
  }
}

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