// server.js - Add socket.io configuration
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true
  }
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(cookieParser());

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("Authentication error"));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

// Store online users
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.userId);
  
  // Add user to online users
  onlineUsers.set(socket.userId, socket.id);
  io.emit("user_online", Array.from(onlineUsers.keys()));
  
  // Handle join room (for private chat)
  socket.on("join_room", (friendId) => {
    const room = [socket.userId, friendId].sort().join("_");
    socket.join(room);
  });
  
  // Handle sending message
  socket.on("send_message", async (data) => {
    const { receiverId, message, messageType } = data;
    const room = [socket.userId, receiverId].sort().join("_");
    
    // Save message to database
    const messageData = {
      senderId: socket.userId,
      receiverId: receiverId,
      message: message,
      messageType: messageType || "text",
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Store in database (you need to add messages collection)
    const db = (await import("./database/db.js")).db;
    const result = await db.collection("messages").insertOne(messageData);
    
    // Emit to receiver if online
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receive_message", {
        ...messageData,
        _id: result.insertedId
      });
    }
    
    // Emit back to sender
    socket.emit("message_sent", {
      ...messageData,
      _id: result.insertedId
    });
  });
  
  // Handle typing indicator
  socket.on("typing", ({ receiverId, isTyping }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user_typing", {
        userId: socket.userId,
        isTyping
      });
    }
  });
  
  // Handle mark as read
  socket.on("mark_as_read", async ({ senderId }) => {
    const db = (await import("./database/db.js")).db;
    await db.collection("messages").updateMany(
      {
        senderId: senderId,
        receiverId: socket.userId,
        isRead: false
      },
      {
        $set: { isRead: true }
      }
    );
    
    const senderSocketId = onlineUsers.get(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messages_read", { userId: socket.userId });
    }
  });
  
  // Handle disconnect
  socket.on("disconnect", () => {
    onlineUsers.delete(socket.userId);
    io.emit("user_offline", socket.userId);
    console.log("User disconnected:", socket.userId);
  });
});

// Import routes
import { connectDB } from "./database/db.js";
import postRoutes from "./routes/postsRoute/postsRoute.js";
import users from "./routes/userRoute/userRoute.js";

// MongoDB connection
await connectDB();

// Routes
app.use("/v1/api/users", users);
app.use("/v1/api/posts", postRoutes);

app.get("/", (req, res) => {
  res.send("BD BOOK server running");
});

const PORT = process.env.PORT || 6969;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});