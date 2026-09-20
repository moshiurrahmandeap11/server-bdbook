import { Gender, UserRole } from "@prisma/client";

export interface ISignupPayload {
  email: string;
  password: string;
  fullName: string;
  gender?: Gender;
  dob?: string | Date;
}

export interface ILoginPayload {
  email: string;
  password: string;
}

export interface IGoogleAuthPayload {
  idToken?: string;
  code?: string;
  redirectUri?: string;
}

export interface IAuthUserResponse {
  id: string;
  _id?: string;
  fullName: string;
  email: string;
  role: UserRole;
  gender?: Gender | null;
  dob?: Date | null;
  profilePicUrl?: string | null;
  profilePicture?: {
    url: string | null;
  } | null;
}

export interface ILoginResult {
  accessToken: string;
  refreshToken: string;
  token?: string;
  user: IAuthUserResponse;
}

export interface IRefreshTokenResult {
  accessToken: string;
  refreshToken: string;
}

export interface ISignupResult {
  id: string;
  email: string;
  fullName: string;
}

