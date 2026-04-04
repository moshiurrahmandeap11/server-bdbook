// server.js
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { initializeSocket } from "./utils/socket.js";


dotenv.config();

const app = express();
const server = createServer(app);

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(cookieParser());

// Import routes
import { connectDB } from "./database/db.js";
import notificationRoutes from "./routes/notificationRoute/notificationRoutes.js";
import postRoutes from "./routes/postsRoute/postsRoute.js";
import users from "./routes/userRoute/userRoute.js";

// MongoDB connection
await connectDB();

// Initialize Socket.io
const socketManager = initializeSocket(server);
console.log("Socket.io initialized with notification support");

// Make socket manager available globally
global.socketManager = socketManager;

// Routes
app.use("/v1/api/users", users);
app.use("/v1/api/posts", postRoutes);
app.use("/v1/api/notifications", notificationRoutes);

app.get("/", (req, res) => {
  res.send("BD BOOK server running");
});

const PORT = process.env.PORT || 6969;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Socket.io is ready for connections");
});