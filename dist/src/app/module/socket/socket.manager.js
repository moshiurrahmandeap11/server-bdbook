import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../../config/env.js";
import { messageService, setMessageSocketEmitter } from "../message/message.service.js";
import { setNotificationSocketEmitter } from "../notification/notification.service.js";
export class SocketManager {
    io;
    onlineUsers;
    rooms;
    constructor(server) {
        this.onlineUsers = new Map();
        this.rooms = new Map();
        this.io = new Server(server, {
            cors: {
                origin: env.ALLOWED_ORIGINS,
                credentials: true,
            },
        });
        this.setupMiddleware();
        this.setupEventHandlers();
        this.setupServiceEmitters();
        console.log("Socket.io initialized successfully");
    }
    setupMiddleware() {
        this.io.use((socket, next) => {
            const token = socket.handshake.auth?.token;
            if (!token) {
                socket.userId = `guest_${Math.random().toString(36).substring(2, 15)}`;
                socket.isGuest = true;
                return next();
            }
            try {
                const decoded = jwt.verify(token, env.JWT_SECRET);
                socket.userId = decoded.id;
                socket.isGuest = false;
            }
            catch {
                socket.userId = `guest_${Math.random().toString(36).substring(2, 15)}`;
                socket.isGuest = true;
            }
            next();
        });
    }
    setupServiceEmitters() {
        // Connect HTTP notification service to socket
        setNotificationSocketEmitter((userId, notification) => {
            const targetSocketId = this.onlineUsers.get(userId);
            if (targetSocketId) {
                this.io.to(targetSocketId).emit("new_notification", notification);
            }
        });
        // Connect HTTP message service to socket
        setMessageSocketEmitter((receiverId, message) => {
            const targetSocketId = this.onlineUsers.get(receiverId);
            if (targetSocketId) {
                this.io.to(targetSocketId).emit("receive_message", message);
            }
        });
    }
    setupEventHandlers() {
        this.io.on("connection", (socket) => {
            this.handleConnection(socket);
        });
    }
    handleConnection(socket) {
        const userId = socket.userId;
        console.log("User connected:", userId, socket.isGuest ? "(guest)" : "(auth)");
        this.onlineUsers.set(userId, socket.id);
        this.io.emit("user_online", Array.from(this.onlineUsers.keys()));
        // ==================== ROOM EVENT HANDLERS ====================
        socket.on("create_room", (data) => {
            const effectiveUserId = data.userId || socket.userId;
            socket.join(data.roomId);
            socket.roomId = data.roomId;
            socket.userId = effectiveUserId;
            socket.userName = data.userName;
            socket.userProfilePicture = data.userProfilePicture;
            this.rooms.set(data.roomId, {
                id: data.roomId,
                name: data.roomName,
                createdBy: effectiveUserId,
                participants: [
                    {
                        userId: effectiveUserId,
                        userName: data.userName,
                        userProfilePicture: data.userProfilePicture,
                    },
                ],
            });
            socket.emit("room_created", { roomId: data.roomId, roomName: data.roomName });
        });
        socket.on("join_room", (data) => {
            const effectiveUserId = data.userId || socket.userId;
            const effectiveUserName = data.userName || "Guest";
            if (!this.rooms.has(data.roomId)) {
                socket.emit("room_error", { message: "Room not found." });
                return;
            }
            const room = this.rooms.get(data.roomId);
            socket.join(data.roomId);
            socket.roomId = data.roomId;
            socket.userId = effectiveUserId;
            socket.userName = effectiveUserName;
            socket.userProfilePicture = data.userProfilePicture;
            if (!room.participants.some((p) => p.userId === effectiveUserId)) {
                room.participants.push({
                    userId: effectiveUserId,
                    userName: effectiveUserName,
                    userProfilePicture: data.userProfilePicture,
                });
            }
            const otherParticipants = room.participants.filter((p) => p.userId !== effectiveUserId);
            socket.emit("room_joined", {
                roomId: data.roomId,
                roomName: room.name,
                participants: otherParticipants,
            });
            socket.to(data.roomId).emit("new_participant", {
                userId: effectiveUserId,
                userName: effectiveUserName,
                userProfilePicture: data.userProfilePicture,
            });
        });
        // ==================== SIGNALING (offer / answer / ice) ====================
        socket.on("offer", (data) => {
            const targetSocketId = this.onlineUsers.get(data.to);
            if (targetSocketId) {
                this.io.to(targetSocketId).emit("offer", {
                    from: socket.userId,
                    offer: data.offer,
                });
            }
        });
        socket.on("answer", (data) => {
            const targetSocketId = this.onlineUsers.get(data.to);
            if (targetSocketId) {
                this.io.to(targetSocketId).emit("answer", {
                    from: socket.userId,
                    answer: data.answer,
                });
            }
        });
        socket.on("ice_candidate", (data) => {
            const targetSocketId = this.onlineUsers.get(data.to);
            if (targetSocketId) {
                this.io.to(targetSocketId).emit("ice_candidate", {
                    from: socket.userId,
                    candidate: data.candidate,
                });
            }
        });
        socket.on("send_room_message", (data) => {
            this.io.to(data.roomId).emit("room_message", {
                userId: data.userId,
                userName: data.userName,
                userProfilePicture: data.userProfilePicture,
                message: data.message,
                timestamp: new Date(),
            });
        });
        socket.on("leave_room", (data) => {
            this.handleLeaveRoom(socket, data.roomId);
        });
        // ==================== PRIVATE CHAT ====================
        socket.on("join_private_room", (friendId) => {
            const room = [socket.userId, friendId].sort().join("_");
            socket.join(room);
        });
        socket.on("leave_private_room", (friendId) => {
            const room = [socket.userId, friendId].sort().join("_");
            socket.leave(room);
        });
        socket.on("send_message", async (data) => {
            await this.handleSocketSendMessage(socket, data);
        });
        socket.on("typing", (data) => {
            const receiverSocketId = this.onlineUsers.get(data.receiverId);
            if (receiverSocketId) {
                this.io.to(receiverSocketId).emit("user_typing", {
                    userId: socket.userId,
                    isTyping: data.isTyping,
                });
            }
        });
        socket.on("mark_as_read", async (data) => {
            if (socket.isGuest)
                return;
            try {
                await messageService.markAsRead(socket.userId, data.senderId);
                const senderSocketId = this.onlineUsers.get(data.senderId);
                if (senderSocketId) {
                    this.io.to(senderSocketId).emit("messages_read", {
                        userId: socket.userId,
                    });
                }
            }
            catch (err) {
                console.error("Socket mark_as_read error:", err);
            }
        });
        // ==================== CALL EVENT HANDLERS ====================
        socket.on("call_user", (data) => {
            socket.callInfo = {
                from: data.from,
                fromName: data.fromName,
                type: data.type,
                offer: data.offer,
                to: data.to,
            };
            const targetSocketId = this.onlineUsers.get(data.to);
            if (targetSocketId) {
                const targetSocket = this.io.sockets.sockets.get(targetSocketId);
                if (targetSocket?.callInfo) {
                    socket.emit("call_busy", { message: "User is on another call" });
                    return;
                }
                this.io.to(targetSocketId).emit("incoming_call", {
                    from: data.from,
                    fromName: data.fromName,
                    type: data.type,
                    offer: data.offer,
                });
            }
            else {
                socket.emit("call_error", { message: "User is offline" });
            }
        });
        socket.on("answer_call", (data) => {
            const targetSocketId = this.onlineUsers.get(data.to);
            if (targetSocketId) {
                this.io.to(targetSocketId).emit("call_accepted", { answer: data.answer });
            }
            else {
                socket.emit("call_error", { message: "User disconnected" });
            }
        });
        socket.on("reject_call", (data) => {
            const targetSocketId = this.onlineUsers.get(data.to);
            if (targetSocketId) {
                this.io.to(targetSocketId).emit("call_rejected");
            }
        });
        socket.on("end_call", (data) => {
            const targetSocketId = this.onlineUsers.get(data.to);
            if (targetSocketId) {
                this.io.to(targetSocketId).emit("call_ended");
            }
            delete socket.callInfo;
        });
        socket.on("call_busy", (data) => {
            const targetSocketId = this.onlineUsers.get(data.to);
            if (targetSocketId) {
                this.io.to(targetSocketId).emit("call_busy");
            }
        });
        // ==================== DISCONNECT ====================
        socket.on("disconnect", () => {
            this.handleDisconnect(socket);
        });
    }
    async handleSocketSendMessage(socket, data) {
        if (socket.isGuest) {
            socket.emit("message_error", {
                tempId: data.tempId,
                error: "Login required to send messages",
            });
            return;
        }
        try {
            const result = await messageService.sendMessage(socket.userId, data.receiverId, {
                message: data.message,
                messageType: data.messageType,
                mediaUrl: data.mediaUrl,
                fileName: data.fileName,
                fileSize: data.fileSize,
                tempId: data.tempId,
            });
            socket.emit("message_sent", result);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to send message";
            socket.emit("message_error", { tempId: data.tempId, error: message });
        }
    }
    handleLeaveRoom(socket, roomId) {
        if (roomId && this.rooms.has(roomId)) {
            const room = this.rooms.get(roomId);
            room.participants = room.participants.filter((p) => p.userId !== socket.userId);
            socket.to(roomId).emit("participant_left", {
                userId: socket.userId,
                userName: socket.userName,
            });
            socket.leave(roomId);
            if (room.participants.length === 0) {
                this.rooms.delete(roomId);
            }
        }
        delete socket.roomId;
    }
    handleDisconnect(socket) {
        if (socket.roomId) {
            this.handleLeaveRoom(socket, socket.roomId);
        }
        this.onlineUsers.delete(socket.userId);
        if (socket.callInfo) {
            const targetSocketId = this.onlineUsers.get(socket.callInfo.to);
            if (targetSocketId) {
                this.io.to(targetSocketId).emit("call_ended");
            }
            delete socket.callInfo;
        }
        this.io.emit("user_offline", socket.userId);
        console.log("User disconnected:", socket.userId);
    }
    getOnlineUsers() {
        return Array.from(this.onlineUsers.keys());
    }
    isUserOnline(userId) {
        return this.onlineUsers.has(userId);
    }
}
let socketManagerInstance = null;
export const initializeSocket = (server) => {
    if (!socketManagerInstance) {
        socketManagerInstance = new SocketManager(server);
    }
    return socketManagerInstance;
};
export const getSocketManager = () => {
    if (!socketManagerInstance) {
        throw new Error("Socket not initialized. Call initializeSocket first.");
    }
    return socketManagerInstance;
};
