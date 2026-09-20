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
  IRefreshTokenResult,
  ISignupPayload,
  ISignupResult,
} from "./auth.interface";
import { tokenUtils } from "../../utils/token";

const signup = async (payload: ISignupPayload): Promise<ISignupResult> => {
  const emailLower = payload.email.toLowerCase().trim();

  const existingUser = await prisma.user.findUnique({
    where: { email: emailLower },
  });

  if (existingUser) {
    throw new AppError(status.CONFLICT, "User already exists with this email");
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  const fullName = (payload.fullName || (payload as any).name || "").trim();
  const newUser = await prisma.user.create({
    data: {
      email: emailLower,
      password: hashedPassword,
      fullName,
      gender: payload.gender,
      dob: payload.dob ? new Date(payload.dob) : null,
      role: "user",
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      gender: true,
      dob: true,
      profilePicUrl: true,
    },
  });

  const jwtPayload = { id: newUser.id, email: newUser.email, role: newUser.role };
  const accessToken = tokenUtils.getAccessToken(jwtPayload);
  const refreshToken = tokenUtils.getRefreshToken(jwtPayload);

  return {
    accessToken,
    refreshToken,
    token: accessToken,
    user: {
      id: newUser.id,
      _id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      gender: newUser.gender,
      dob: newUser.dob,
      profilePicUrl: newUser.profilePicUrl,
      profilePicture: newUser.profilePicUrl ? { url: newUser.profilePicUrl } : null,
    },
  };
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

  const jwtPayload = { id: user.id, email: user.email, role: user.role };
  const accessToken = tokenUtils.getAccessToken(jwtPayload);
  const refreshToken = tokenUtils.getRefreshToken(jwtPayload);

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
    accessToken,
    refreshToken,
    token: accessToken,
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

    if (!userRes.ok) {
      throw new AppError(status.UNAUTHORIZED, "Failed to retrieve Google user profile");
    }

    const userData = await userRes.json();
    if (!userData.email) {
      throw new AppError(status.UNAUTHORIZED, "Google account does not provide an email address");
    }

    email = userData.email.toLowerCase().trim();
    fullName = userData.name || email.split("@")[0];
    profilePicUrl = userData.picture || null;
  } else {
    throw new AppError(status.BAD_REQUEST, "Either idToken or code must be provided");
  }

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    const randomPassword = await bcrypt.hash(
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36),
      10
    );
    user = await prisma.user.create({
      data: {
        email,
        password: randomPassword,
        fullName: fullName.trim(),
        profilePicUrl,
        isVerified: true,
        role: "user",
        isActive: true,
      },
    });
  } else {
    if (!user.isActive) {
      throw new AppError(status.FORBIDDEN, "Your account has been deactivated");
    }
    if (!user.profilePicUrl && profilePicUrl) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { profilePicUrl },
      });
    }
  }

  const jwtPayload = { id: user.id, email: user.email, role: user.role };
  const accessToken = tokenUtils.getAccessToken(jwtPayload);
  const refreshToken = tokenUtils.getRefreshToken(jwtPayload);

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
    accessToken,
    refreshToken,
    token: accessToken,
    user: userResponse,
  };
};

const getNewToken = async (refreshToken: string): Promise<IRefreshTokenResult> => {
  if (!refreshToken) {
    throw new AppError(status.UNAUTHORIZED, "Refresh token is missing");
  }

  let decoded: any;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError(status.UNAUTHORIZED, "Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

  if (!user) {
    throw new AppError(status.UNAUTHORIZED, "User not found");
  }

  if (!user.isActive) {
    throw new AppError(status.FORBIDDEN, "Your account has been deactivated");
  }

  const jwtPayload = { id: user.id, email: user.email, role: user.role };
  const newAccessToken = tokenUtils.getAccessToken(jwtPayload);
  const newRefreshToken = tokenUtils.getRefreshToken(jwtPayload);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const getMe = async (userId: string): Promise<IAuthUserResponse> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(status.NOT_FOUND, "User not found");
  }

  return {
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
};

export const authService = {
  signup,
  login,
  googleAuth,
  getNewToken,
  getMe,
};
