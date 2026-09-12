import status from "http-status";
import { ZodError } from "zod";
import { IErrorSources, IGenericErrorResponse } from "../interfaces/error.interface";

export const handleZodError = (err: ZodError): IGenericErrorResponse => {
  const statusCode = status.BAD_REQUEST;
  const message = "Validation Error";
  const errorSources: IErrorSources[] = err.issues.map((issue) => ({
    path: issue.path.join(" => "),
    message: issue.message,
  }));

  return {
    statusCode,
    success: false,
    message,
    errorSources,
  };
};

