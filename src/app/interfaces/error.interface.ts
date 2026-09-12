export interface IErrorSources {
  path: string;
  message: string;
}

export interface IGenericErrorResponse {
  statusCode: number;
  success: boolean;
  message: string;
  errorSources: IErrorSources[];
  stack?: string;
  error?: unknown;
}

