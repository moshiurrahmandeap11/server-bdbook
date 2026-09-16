import bcrypt from "bcryptjs";
import status from "http-status";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import AppError from "../../errorHelpers/AppError.js";
import { prisma } from "../../lib/prisma.js";
const signup = async (payload) => {
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
const login = async (payload) => {
    const emailLower = payload.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
        where: { email: emailLower },
    });
    if (!user) {
        throw new AppError(status.UNAUTHORIZED, "Invalid credentials");
    }
    if (!user.isActive) {
        throw new AppError(status.FORBIDDEN, "Your account has been deactivated");
    }
    const isMatch = await bcrypt.compare(payload.password, user.password);
    if (!isMatch) {
        throw new AppError(status.UNAUTHORIZED, "Invalid credentials");
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES });
    const userResponse = {
        id: user.id,
        _id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        gender: user.gender,
        dob: user.dob,
        profilePicUrl: user.profilePicUrl,
        profilePicture: user.profilePicUrl ? { url: user.profilePicUrl } : null,
    };
    return {
        token,
        user: userResponse,
    };
};
export const authService = {
    signup,
    login,
};
