import { Server as HttpServer } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../../config/env";
import { IAuthUser } from "../../interfaces/common.interface";
import { prisma } from "../../lib/prisma";
import { messageService, setMessageSocketEmitter } from "../message/message.service";
import { setNotificationSocketEmitter } from "../notification/notification.service";
import {
  IAnswerCallPayload,
  ICallUserPayload,
  ICreateRoomPayload,
  ICustomSocket,
  IIceCandidatePayload,
  IJoinRoomPayload,
  IRoomMessagePayload,
  IRoomSession,
  ISendSocketMessagePayload,
  ISignalingAnswerPayload,
  ISignalingOfferPayload,
  ITypingPayload,
} from "./socket.interface";

export class SocketManager {
  public io: Server;
  public onlineUsers: Map<string, string>;
  public rooms: Map<string, IRoomSession>;

  constructor(server: HttpServer) {
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

  private setupMiddleware() {
    this.io.use((socket: ICustomSocket, next) => {
      // 1. Try handshake auth token
      let token = socket.handshake.auth?.token;

      // 2. Try handshake headers authorization (Bearer token)
      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(" ");
        if (parts.length === 2 && parts[0] === "Bearer") {
          token = parts[1];
        }
      }

      // 3. Try handshake cookie (accessToken or token)
      if (!token && socket.handshake.headers?.cookie) {
        try {
          const cookieEntries = socket.handshake.headers.cookie.split(";");
          for (const c of cookieEntries) {
            const [k, ...v] = c.trim().split("=");
            if (k === "accessToken" || k === "token") {
              token = decodeURIComponent(v.join("="));
              break;
            }
          }
        } catch {}
      }

      // 4. Query userId fallback if provided
      const queryUserId = socket.handshake.query?.userId as string | undefined;

      if (!token) {
        if (queryUserId && !queryUserId.startsWith("guest_")) {
          socket.userId = queryUserId;
          socket.isGuest = false;
          return next();
        }
        socket.userId = `guest_${Math.random().toString(36).substring(2, 15)}`;
        socket.isGuest = true;
        return next();
      }

      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & IAuthUser;
        socket.userId = decoded.id;
        socket.isGuest = false;
      } catch {
        if (queryUserId && !queryUserId.startsWith("guest_")) {
          socket.userId = queryUserId;
          socket.isGuest = false;
        } else {
          socket.userId = `guest_${Math.random().toString(36).substring(2, 15)}`;
          socket.isGuest = true;
        }
      }

      next();
    });
  }

  private setupServiceEmitters() {
    // Connect HTTP notification service to socket
    setNotificationSocketEmitter((userId: string, notification: unknown) => {
      const targetSocketId = this.onlineUsers.get(userId);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("new_notification", notification);
      }
    });

    // Connect HTTP message service to socket
    setMessageSocketEmitter((receiverId: string, message: unknown) => {
      const targetSocketId = this.onlineUsers.get(receiverId);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("receive_message", message);
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: ICustomSocket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: ICustomSocket) {
    const userId = socket.userId!;
    console.log("User connected:", userId, socket.isGuest ? "(guest)" : "(auth)");

    this.onlineUsers.set(userId, socket.id);
    const onlineList = Array.from(this.onlineUsers.keys());
    this.io.emit("user_online", onlineList);
    socket.emit("getOnlineUsers", onlineList);

    // ==================== ROOM EVENT HANDLERS ====================
    socket.on("create_room", (data: ICreateRoomPayload) => {
      const effectiveUserId = data.userId || socket.userId!;
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

    socket.on("join_room", (data: IJoinRoomPayload) => {
      const effectiveUserId = data.userId || socket.userId!;
      const effectiveUserName = data.userName || "Guest";

      if (!this.rooms.has(data.roomId)) {
        socket.emit("room_error", { message: "Room not found." });
        return;
      }

      const room = this.rooms.get(data.roomId)!;
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

      const otherParticipants = room.participants.filter(
        (p) => p.userId !== effectiveUserId
      );

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
    socket.on("offer", (data: ISignalingOfferPayload) => {
      const targetSocketId = this.onlineUsers.get(data.to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("offer", {
          from: socket.userId,
          offer: data.offer,
        });
      }
    });

    socket.on("answer", (data: ISignalingAnswerPayload) => {
      const targetSocketId = this.onlineUsers.get(data.to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("answer", {
          from: socket.userId,
          answer: data.answer,
        });
      }
    });

    socket.on("ice_candidate", (data: IIceCandidatePayload) => {
      const targetSocketId = this.onlineUsers.get(data.to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("ice_candidate", {
          from: socket.userId,
          candidate: data.candidate,
        });
      }
    });

    socket.on("send_room_message", (data: IRoomMessagePayload) => {
      this.io.to(data.roomId).emit("room_message", {
        userId: data.userId,
        userName: data.userName,
        userProfilePicture: data.userProfilePicture,
        message: data.message,
        timestamp: new Date(),
      });
    });

    socket.on("leave_room", (data: { roomId: string }) => {
      this.handleLeaveRoom(socket, data.roomId);
    });

    // ==================== PRIVATE CHAT ====================
    socket.on("join_private_room", (friendId: string) => {
      const room = [socket.userId, friendId].sort().join("_");
      socket.join(room);
    });

    socket.on("leave_private_room", (friendId: string) => {
      const room = [socket.userId, friendId].sort().join("_");
      socket.leave(room);
    });

    socket.on("send_message", async (data: ISendSocketMessagePayload) => {
      await this.handleSocketSendMessage(socket, data);
    });

    socket.on("typing", (data: ITypingPayload) => {
      const receiverSocketId = this.onlineUsers.get(data.receiverId);
      if (receiverSocketId) {
        this.io.to(receiverSocketId).emit("user_typing", {
          userId: socket.userId,
          isTyping: data.isTyping,
        });
      }
    });

    socket.on("mark_as_read", async (data: { senderId: string }) => {
      if (socket.isGuest) return;
      try {
        await messageService.markAsRead(socket.userId!, data.senderId);
        const senderSocketId = this.onlineUsers.get(data.senderId);
        if (senderSocketId) {
          this.io.to(senderSocketId).emit("messages_read", {
            userId: socket.userId,
          });
        }
      } catch (err) {
        console.error("Socket mark_as_read error:", err);
      }
    });

    // ==================== CALL EVENT HANDLERS ====================
    socket.on("call_user", (data: ICallUserPayload) => {
      socket.callInfo = {
        from: data.from,
        fromName: data.fromName,
        type: data.type,
        offer: data.offer,
        to: data.to,
      };

      const targetSocketId = this.onlineUsers.get(data.to);
      if (targetSocketId) {
        const targetSocket = this.io.sockets.sockets.get(
          targetSocketId
        ) as ICustomSocket | undefined;

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
      } else {
        socket.emit("call_error", { message: "User is offline" });
      }
    });

    socket.on("answer_call", (data: IAnswerCallPayload) => {
      const targetSocketId = this.onlineUsers.get(data.to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_accepted", { answer: data.answer });
      } else {
        socket.emit("call_error", { message: "User disconnected" });
      }
    });

    socket.on("reject_call", (data: { to: string }) => {
      const targetSocketId = this.onlineUsers.get(data.to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_rejected");
      }
    });

    socket.on("end_call", (data: { to: string }) => {
      const targetSocketId = this.onlineUsers.get(data.to);
      if (targetSocketId) {
        this.io.to(targetSocketId).emit("call_ended");
      }
      delete socket.callInfo;
    });

    socket.on("call_busy", (data: { to: string }) => {
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

  private async handleSocketSendMessage(
    socket: ICustomSocket,
    data: ISendSocketMessagePayload
  ) {
    if (socket.isGuest) {
      socket.emit("message_error", {
        tempId: data.tempId,
        error: "Login required to send messages",
      });
      return;
    }

    try {
      const result = await messageService.sendMessage(socket.userId!, data.receiverId, {
        message: data.message,
        messageType: data.messageType,
        mediaUrl: data.mediaUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        tempId: data.tempId,
      });

      socket.emit("message_sent", result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      socket.emit("message_error", { tempId: data.tempId, error: message });
    }
  }

  private handleLeaveRoom(socket: ICustomSocket, roomId: string) {
    if (roomId && this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId)!;
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

  private handleDisconnect(socket: ICustomSocket) {
    if (socket.roomId) {
      this.handleLeaveRoom(socket, socket.roomId);
    }

    this.onlineUsers.delete(socket.userId!);

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

  public getOnlineUsers(): string[] {
    return Array.from(this.onlineUsers.keys());
  }

  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
}

let socketManagerInstance: SocketManager | null = null;

export const initializeSocket = (server: HttpServer): SocketManager => {
  if (!socketManagerInstance) {
    socketManagerInstance = new SocketManager(server);
  }
  return socketManagerInstance;
};

export const getSocketManager = (): SocketManager => {
  if (!socketManagerInstance) {
    throw new Error("Socket not initialized. Call initializeSocket first.");
  }
  return socketManagerInstance;
};

