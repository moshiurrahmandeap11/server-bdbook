import { IAuthUser } from "./common.interface";

declare global {
  namespace Express {
    interface Request {
      user?: IAuthUser;
    }
  }
}

export {};

