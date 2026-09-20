import { Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { CookieUtils } from "./cookie";

export const ms = (timeStr: string): number => {
  const match = timeStr.match(/^([0-9]+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid time format: "${timeStr}". Expected format like "30s", "15m", "7d".`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return value;
  }
};

export const getCookieDomain = (req?: Request): string | undefined => {
  if (env.NODE_ENV === "production") {
    return undefined;
  }
  return ".localhost";
};

const getAccessToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as any,
  });
};

const getRefreshToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as any,
  });
};

const setAccessTokenCookie = (res: Response, token: string, req?: Request) => {
  const targetDomain = getCookieDomain(req);
  CookieUtils.setCookie(res, "accessToken", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    domain: targetDomain,
    maxAge: ms(env.ACCESS_TOKEN_EXPIRES_IN),
  });
};

const setRefreshTokenCookie = (res: Response, token: string, req?: Request) => {
  const targetDomain = getCookieDomain(req);
  CookieUtils.setCookie(res, "refreshToken", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
    domain: targetDomain,
    maxAge: ms(env.REFRESH_TOKEN_EXPIRES_IN),
  });
};

const clearAuthCookies = (res: Response, req?: Request) => {
  const targetDomain = getCookieDomain(req);
  const options = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    path: "/",
    domain: targetDomain,
  };

  CookieUtils.clearCookie(res, "accessToken", options);
  CookieUtils.clearCookie(res, "refreshToken", options);
  CookieUtils.clearCookie(res, "token", options);
};

export const tokenUtils = {
  ms,
  getCookieDomain,
  getAccessToken,
  getRefreshToken,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
};

