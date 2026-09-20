import bcrypt from "bcryptjs";
import status from "http-status";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import {
  IAuthUserResponse,
  ILoginPayload,
  ILoginResult,
  ISignupPayload,
  ISignupResult,
} from "./auth.interface";

const signup = async (payload: ISignupPayload): Promise<ISignupResult> => {
  const emailLower = payload.email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({
    where: { email: emailLower },
  });

  if (existingUser) {
    throw new AppError(status.CONFLICT, "User already exists with this email");
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  const newUser = await prisma.user.create({
    data: {
      email: emailLower,
      password: hashedPassword,
      fullName: payload.fullName.trim(),
      gender: payload.gender,
      dob: payload.dob ? new Date(payload.dob) : null,
      role: "user",
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  });

  return newUser;
};

const login = async (payload: ILoginPayload): Promise<ILoginResult> => {
  const emailLower = payload.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: emailLower },
  });

    if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }
  throw new Error("WIP");
};

export const authService = {
  login,
  register,
  changePassword,
  googleAuth,
};
