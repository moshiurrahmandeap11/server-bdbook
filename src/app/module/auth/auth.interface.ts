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
  token: string;
  user: IAuthUserResponse;
}

export interface ISignupResult {
  id: string;
  email: string;
  fullName: string;
}

