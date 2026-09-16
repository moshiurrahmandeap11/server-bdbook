import status from "http-status";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import AppError from "../errorHelpers/AppError.js";
export const auth = (...requiredRoles) => {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = req.cookies?.token ||
            (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader);
        if (!token) {
            throw new AppError(status.UNAUTHORIZED, "Access denied. No token provided.");
        }
        try {
            const decoded = jwt.verify(token, env.JWT_SECRET);
            if (requiredRoles.length > 0 && !requiredRoles.includes(decoded.role)) {
                throw new AppError(status.FORBIDDEN, "You do not have permission to perform this action");
            }
            req.user = {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
            };
            next();
        }
        catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(status.FORBIDDEN, "Invalid or expired token");
        }
    };
};
export const authenticateToken = auth();
