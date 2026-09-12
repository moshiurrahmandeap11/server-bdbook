import { Response } from "express";
import status from "http-status";
import { IResponseData } from "../interfaces/response.interface";

const addMongoIdAlias = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(addMongoIdAlias);

  const result: any = { ...obj };
  if (result.id && !result._id) {
    result._id = result.id;
  }
  for (const key of Object.keys(result)) {
    if (result[key] && typeof result[key] === "object" && !(result[key] instanceof Date)) {
      result[key] = addMongoIdAlias(result[key]);
    }
  }
  return result;
};

export const sendResponse = <T>(res: Response, responseData: IResponseData<T>) => {
  const statusCode = responseData.httpStatusCode || responseData.statusCode || status.OK;
  const transformedData = responseData.data !== undefined ? addMongoIdAlias(responseData.data) : undefined;

  const jsonResponse: Record<string, any> = {
    success: responseData.success,
    message: responseData.message,
  };

  if (transformedData !== undefined) {
    jsonResponse.data = transformedData;
  }

  if (responseData.token !== undefined) {
    jsonResponse.token = responseData.token;
  }

  if (responseData.user !== undefined) {
    jsonResponse.user = addMongoIdAlias(responseData.user);
  }

  if (responseData.meta) {
    jsonResponse.meta = responseData.meta;
    jsonResponse.pagination = responseData.meta;
  } else if (responseData.pagination) {
    jsonResponse.pagination = responseData.pagination;
    jsonResponse.meta = responseData.pagination;
  }

  if (responseData.unreadCount !== undefined) {
    jsonResponse.unreadCount = responseData.unreadCount;
  }

  if (responseData.count !== undefined) {
    jsonResponse.count = responseData.count;
  }

  res.status(statusCode).json(jsonResponse);
};

