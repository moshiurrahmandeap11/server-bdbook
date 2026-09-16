import { Prisma } from "@prisma/client";
import status from "http-status";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import AppError from "../errorHelpers/AppError.js";
import { handlePrismaClientKnownRequestError, handlePrismaClientUnknownError, handlePrismaClientValidationError, handlerPrismaClientInitializationError, handlerPrismaClientRustPanicError, } from "../errorHelpers/handlePrismaErrors.js";
import { handleZodError } from "../errorHelpers/handleZodError.js";
export const globalErrorHandler = (err, req, res, next) => {
    if (env.NODE_ENV === "development") {
        console.error("💥 Error Caught by globalErrorHandler:", err);
    }
    let errorSources = [];
    let statusCode = status.INTERNAL_SERVER_ERROR;
    let message = "Internal Server Error";
    let stack = undefined;
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        const simplified = handlePrismaClientKnownRequestError(err);
        statusCode = simplified.statusCode;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    }
    else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
        const simplified = handlePrismaClientUnknownError(err);
        statusCode = simplified.statusCode;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    }
    else if (err instanceof Prisma.PrismaClientValidationError) {
        const simplified = handlePrismaClientValidationError(err);
        statusCode = simplified.statusCode;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    }
    else if (err instanceof Prisma.PrismaClientRustPanicError) {
        const simplified = handlerPrismaClientRustPanicError();
        statusCode = simplified.statusCode;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    }
    else if (err instanceof Prisma.PrismaClientInitializationError) {
        const simplified = handlerPrismaClientInitializationError(err);
        statusCode = simplified.statusCode;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    }
    else if (err instanceof ZodError) {
        const simplified = handleZodError(err);
        statusCode = simplified.statusCode;
        message = simplified.message;
        errorSources = simplified.errorSources;
        stack = err.stack;
    }
    else if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        stack = err.stack;
        errorSources = [{ path: "", message: err.message }];
    }
    else if (err instanceof Error) {
        statusCode = status.INTERNAL_SERVER_ERROR;
        message = err.message || "Internal Server Error";
        stack = err.stack;
        errorSources = [{ path: "", message: err.message }];
    }
    const responsePayload = {
        statusCode,
        success: false,
        message,
        errorSources,
        error: env.NODE_ENV === "development" ? err : undefined,
        stack: env.NODE_ENV === "development" ? stack : undefined,
    };
    res.status(statusCode).json(responsePayload);
};
