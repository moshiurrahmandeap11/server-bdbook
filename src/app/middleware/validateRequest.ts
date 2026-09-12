import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodEffects } from "zod";

export const validateRequest = (
  schema: AnyZodObject | ZodEffects<AnyZodObject>
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body?.data && typeof req.body.data === "string") {
        try {
          req.body = JSON.parse(req.body.data);
        } catch {
          // ignore if parsing fails
        }
      }

      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
};

