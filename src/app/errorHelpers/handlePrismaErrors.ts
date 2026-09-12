import { Prisma } from "@prisma/client";
import status from "http-status";
import { IErrorSources, IGenericErrorResponse } from "../interfaces/error.interface";

const getStatusCodeFromPrismaError = (errorCode: string): number => {
  if (errorCode === "P2002") {
    return status.CONFLICT;
  }
  if (["P2025", "P2001", "P2015", "P2018"].includes(errorCode)) {
    return status.NOT_FOUND;
  }
  if (["P1000", "P6002"].includes(errorCode)) {
    return status.UNAUTHORIZED;
  }
  if (["P1010", "P6010"].includes(errorCode)) {
    return status.FORBIDDEN;
  }
  if (errorCode === "P6003") {
    return status.PAYMENT_REQUIRED;
  }
  if (["P1008", "P2004", "P6004"].includes(errorCode)) {
    return status.GATEWAY_TIMEOUT;
  }
  if (errorCode === "P5011") {
    return status.TOO_MANY_REQUESTS;
  }
  if (errorCode.startsWith("P1") || ["P2024", "P2037", "P6008"].includes(errorCode)) {
    return status.SERVICE_UNAVAILABLE;
  }
  if (errorCode.startsWith("P2")) {
    return status.BAD_REQUEST;
  }
  return status.INTERNAL_SERVER_ERROR;
};

export const handlePrismaClientKnownRequestError = (
  error: Prisma.PrismaClientKnownRequestError
): IGenericErrorResponse => {
  const statusCode = getStatusCodeFromPrismaError(error.code);
  const meta = error.meta as Record<string, unknown> | undefined;

  const modelName = meta?.modelName as string | undefined;
  const cause = meta?.cause as string | undefined;
  const target = meta?.target as string[] | string | undefined;

  let message: string;
  let errorPath: string = error.code;

  switch (error.code) {
    case "P2025":
      message = modelName
        ? `${modelName} record not found`
        : cause
        ? cause
        : "The requested record was not found";
      break;

    case "P2001":
      message = modelName
        ? `${modelName} record does not exist`
        : "The record searched for does not exist";
      break;

    case "P2002": {
      const fields = Array.isArray(target) ? target.join(", ") : (target ?? "field");
      message = `A record with this ${fields} already exists`;
      errorPath = String(fields);
      break;
    }

    case "P2003": {
      const field = meta?.field_name as string | undefined;
      message = field
        ? `Foreign key constraint failed on field: ${field}`
        : "Foreign key constraint failed";
      errorPath = field ?? error.code;
      break;
    }

    case "P2011": {
      const field = meta?.constraint as string | undefined;
      message = field
        ? `${field} is required and cannot be null`
        : "A required field cannot be null";
      errorPath = field ?? error.code;
      break;
    }

    case "P2024":
      message = "Database connection timed out. Please try again";
      break;

    default: {
      const cleanMessage = error.message
        .replace(/Invalid `.*?` invocation:?\s*/i, "")
        .split("\n")
        .map((l: string) => l.trim())
        .find((l: string) => l.length > 5) ?? "A database error occurred";
      message = cleanMessage;
    }
  }

  const errorSources: IErrorSources[] = [{ path: errorPath, message }];

  if (cause && error.code !== "P2025") {
    errorSources.push({ path: "cause", message });
  }

  return {
    statusCode,
    success: false,
    message,
    errorSources,
  };
};

export const handlePrismaClientUnknownError = (
  error: Prisma.PrismaClientUnknownRequestError
): IGenericErrorResponse => {
  const cleanMessage =
    error.message
      .replace(/Invalid `.*?` invocation:?\s*/i, "")
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0)[0] ?? "An unknown database error occurred";

  return {
    statusCode: status.INTERNAL_SERVER_ERROR,
    success: false,
    message: cleanMessage,
    errorSources: [{ path: "database", message: cleanMessage }],
  };
};

export const handlePrismaClientValidationError = (
  error: Prisma.PrismaClientValidationError
): IGenericErrorResponse => {
  const cleanMessage = error.message
    .replace(/Invalid `.*?` invocation:?\s*/i, "")
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  const fieldMatch = error.message.match(/Argument `(\w+)`/i);
  const fieldName = fieldMatch ? fieldMatch[1] : "field";

  const mainMessage =
    cleanMessage.find(
      (l: string) => !l.includes("Argument") && !l.includes("→") && l.length > 10
    ) ?? cleanMessage[0] ?? "Invalid data provided for database operation";

  return {
    statusCode: status.BAD_REQUEST,
    success: false,
    message: "Validation failed - check submitted data",
    errorSources: [{ path: fieldName, message: mainMessage }],
  };
};

export const handlerPrismaClientInitializationError = (
  error: Prisma.PrismaClientInitializationError
): IGenericErrorResponse => {
  const statusCode = error.errorCode
    ? getStatusCodeFromPrismaError(error.errorCode)
    : status.SERVICE_UNAVAILABLE;

  const mainMessage =
    error.message
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0)[0] ?? "Database service is unavailable";

  return {
    statusCode,
    success: false,
    message: mainMessage,
    errorSources: [{ path: error.errorCode ?? "initialization", message: mainMessage }],
  };
};

export const handlerPrismaClientRustPanicError = (): IGenericErrorResponse => ({
  statusCode: status.INTERNAL_SERVER_ERROR,
  success: false,
  message: "A critical database engine error occurred.",
  errorSources: [
    {
      path: "database_engine",
      message: "The Prisma engine encountered a fatal error. Please check logs.",
    },
  ],
});

