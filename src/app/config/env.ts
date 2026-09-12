import dotenv from "dotenv";
import status from "http-status";
import AppError from "../errorHelpers/AppError";
import { IEnvConfig } from "../interfaces/config.interface";

dotenv.config();

const loadEnvVariables = (): IEnvConfig => {
  const requiredEnvVariables = [
    "DATABASE_URL",
    "JWT_SECRET",
  ];

  requiredEnvVariables.forEach((variable) => {
    if (!process.env[variable]) {
      throw new AppError(
        status.INTERNAL_SERVER_ERROR,
        `Environment variable ${variable} is required but not set in .env file.`
      );
    }
  });

  const allowedOriginsString = process.env.ALLOWED_ORIGINS || "";
  const allowedOrigins = allowedOriginsString
    ? allowedOriginsString.split(",").map((o) => o.trim()).filter(Boolean)
    : [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3005",
        "https://client-bdbook.vercel.app",
      ];

  return {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: Number(process.env.PORT) || 6969,
    DATABASE_URL: process.env.DATABASE_URL as string,
    JWT_SECRET: process.env.JWT_SECRET as string,
    JWT_EXPIRES: process.env.JWT_EXPIRES || "7d",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
    ALLOWED_ORIGINS: allowedOrigins,
  };
};

export const env = loadEnvVariables();

