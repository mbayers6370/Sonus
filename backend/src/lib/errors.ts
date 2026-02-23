export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(params: { message: string; statusCode: number; code: string; details?: unknown }) {
    super(params.message);
    this.name = 'AppError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function badRequest(message: string, details?: unknown) {
  return new AppError({ statusCode: 400, code: 'bad_request', message, details });
}

export function unauthorized(message = 'Unauthorized') {
  return new AppError({ statusCode: 401, code: 'unauthorized', message });
}

export function forbidden(message = 'Forbidden') {
  return new AppError({ statusCode: 403, code: 'forbidden', message });
}

export function notFound(message = 'Not Found') {
  return new AppError({ statusCode: 404, code: 'not_found', message });
}

export function conflict(message: string, details?: unknown) {
  return new AppError({ statusCode: 409, code: 'conflict', message, details });
}
