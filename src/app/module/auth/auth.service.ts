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
    throw new AppError(status.UNAUTHORIZED, "Invalid credentials");
  }

  if (!user.isActive) {
    throw new AppError(status.FORBIDDEN, "Your account has been deactivated");
  }

  const isMatch = await bcrypt.compare(payload.password, user.password);
  if (!isMatch) {
    throw new AppError(status.UNAUTHORIZED, "Invalid credentials");
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES as any }
  );

  const userResponse: IAuthUserResponse = {
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

const googleAuth = async (payload: IGoogleAuthPayload): Promise<ILoginResult> => {
  let email = "";
  let fullName = "";
  let profilePicUrl: string | null = null;

  if (payload.idToken) {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(payload.idToken)}`
    );
    if (!res.ok) {
      throw new AppError(status.UNAUTHORIZED, "Invalid Google ID token");
    }
    const tokenInfo = await res.json();
    if (!tokenInfo.email) {
      throw new AppError(status.UNAUTHORIZED, "Google account does not provide an email address");
    }
    email = tokenInfo.email.toLowerCase().trim();
    fullName = tokenInfo.name || tokenInfo.given_name || email.split("@")[0];
    profilePicUrl = tokenInfo.picture || null;
  } else if (payload.code) {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: payload.code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: payload.redirectUri || "http://localhost:3001/auth/callback/google",
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errorData = await tokenRes.json().catch(() => ({}));
      throw new AppError(
        status.UNAUTHORIZED,
        errorData.error_description || "Failed to exchange Google authorization code"
      );
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

      throw new Error("WIP");
};

export const authService = {
  login,
  register,
  changePassword,
  googleAuth,
};
