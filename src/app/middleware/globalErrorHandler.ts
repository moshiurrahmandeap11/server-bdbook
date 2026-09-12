import { Prisma } from "@prisma/client";
import { ErrorRequestHandler } from "express";
import status from "http-status";
import { ZodError } from "zod";
import { env } from "../config/env";
import AppError from "../errorHelpers/AppError";
import {
  handlePrismaClientKnownRequestError,
  handlePrismaClientUnknownError,
  handlePrismaClientValidationError,
  handlerPrismaClientInitializationError,
  handlerPrismaClientRustPanicError,
} from "../errorHelpers/handlePrismaErrors";
import { handleZodError } from "../errorHelpers/handleZodError";
import { IErrorSources, IGenericErrorResponse } from "../interfaces/error.interface";

export const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (env.NODE_ENV === "development") {
    console.error("💥 Error Caught by globalErrorHandler:", err);
  }

  let errorSources: IErrorSources[] = [];
  let statusCode: number = status.INTERNAL_SERVER_ERROR;
  let message: string = "Internal Server Error";
  let stack: string | undefined = undefined;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const simplified = handlePrismaClientKnownRequestError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
    stack = err.stack;
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const simplified = handlePrismaClientUnknownError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
    stack = err.stack;
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    const simplified = handlePrismaClientValidationError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
    stack = err.stack;
  } else if (err instanceof Prisma.PrismaClientRustPanicError) {
    const simplified = handlerPrismaClientRustPanicError();
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
    stack = err.stack;
  } else if (err instanceof Prisma.PrismaClientInitializationError) {
    const simplified = handlerPrismaClientInitializationError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
    stack = err.stack;
  } else if (err instanceof ZodError) {
    const simplified = handleZodError(err);
    statusCode = simplified.statusCode;
    message = simplified.message;
    errorSources = simplified.errorSources;
    stack = err.stack;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    stack = err.stack;
    errorSources = [{ path: "", message: err.message }];
  } else if (err instanceof Error) {
    statusCode = status.INTERNAL_SERVER_ERROR;
    message = err.message || "Internal Server Error";
    stack = err.stack;
    errorSources = [{ path: "", message: err.message }];
  }

  const responsePayload: IGenericErrorResponse = {
    statusCode,
    success: false,
    message,
    errorSources,
    error: env.NODE_ENV === "development" ? err : undefined,
    stack: env.NODE_ENV === "development" ? stack : undefined,
  };

  res.status(statusCode).json(responsePayload);
};

