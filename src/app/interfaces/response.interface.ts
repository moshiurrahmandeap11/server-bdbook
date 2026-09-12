export interface IResponseMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IResponseData<T> {
  httpStatusCode?: number;
  statusCode?: number;
  success: boolean;
  message: string;
  data?: T;
  meta?: IResponseMeta;
  pagination?: IResponseMeta;
  token?: string;
  user?: unknown;
  unreadCount?: number;
  count?: number;
}

