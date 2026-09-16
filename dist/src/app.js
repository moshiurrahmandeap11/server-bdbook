import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./app/config/env.js";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler.js";
import { notFound } from "./app/middleware/notFound.js";
import { IndexRoutes } from "./app/routes/index.js";
const app = express();
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        if (env.ALLOWED_ORIGINS.includes(origin) || env.NODE_ENV === "development") {
            return callback(null, true);
        }
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
    ],
    exposedHeaders: ["Set-Cookie", "Date"],
    maxAge: 86400,
};
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Primary API prefix for client-bdbook compatibility
app.use("/v1/api", IndexRoutes);
// Alternate standard API prefixes
app.use("/api/v1", IndexRoutes);
app.use("/api", IndexRoutes);
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "BDBook Enterprise Modular Server is running!",
        timestamp: new Date().toISOString(),
    });
});
app.use(notFound);
app.use(globalErrorHandler);
export default app;
