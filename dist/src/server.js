import { createServer } from "http";
import app from "./app.js";
import { env } from "./app/config/env.js";
import { prisma } from "./app/lib/prisma.js";
import { initializeSocket } from "./app/module/socket/socket.manager.js";
let httpServer;
const bootstrap = async () => {
    try {
        httpServer = createServer(app);
        // Initialize Socket.io and WebRTC signaling
        initializeSocket(httpServer);
        httpServer.listen(env.PORT, () => {
            console.log(`🚀 BDBook Server running on http://localhost:${env.PORT}`);
            console.log(`📡 Socket.io connected and ready on port ${env.PORT}`);
        });
    }
    catch (error) {
        console.error("Failed to bootstrap server:", error);
        process.exit(1);
    }
};
const handleExit = async () => {
    console.log("Shutting down server gracefully...");
    try {
        await prisma.$disconnect();
        if (httpServer) {
            httpServer.close(() => {
                console.log("HTTP and Socket server closed gracefully.");
                process.exit(0);
            });
        }
        else {
            process.exit(0);
        }
    }
    catch (err) {
        console.error("Error during graceful shutdown:", err);
        process.exit(1);
    }
};
process.on("SIGTERM", handleExit);
process.on("SIGINT", handleExit);
bootstrap();
