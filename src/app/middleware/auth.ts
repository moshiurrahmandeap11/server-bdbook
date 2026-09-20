import { NextFunction, Request, Response } from "express";
import status from "http-status";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import AppError from "../errorHelpers/AppError";
import { IAuthUser } from "../interfaces/common.interface";

export const auth = (...requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token =
      req.cookies?.accessToken ||
      req.cookies?.token ||
      (authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader);

    if (!token) {
      throw new AppError(status.UNAUTHORIZED, "Access denied. No token provided.");
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & IAuthUser;

      if (requiredRoles.length > 0 && !requiredRoles.includes(decoded.role)) {
        throw new AppError(status.FORBIDDEN, "You do not have permission to perform this action");
      }

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      };

      next();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(status.UNAUTHORIZED, "Invalid or expired token");
    }
  };
};

export const authenticateToken = auth();
