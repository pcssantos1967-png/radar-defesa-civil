import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('error-handler');

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  logger.error({
    err: error,
    url: request.url,
    method: request.method,
    userId: request.user?.userId,
  });

  let response: ErrorResponse;
  let statusCode: number;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    response = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  } else if (error instanceof ZodError) {
    statusCode = 400;
    response = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    };
  } else if ('statusCode' in error && typeof error.statusCode === 'number') {
    statusCode = error.statusCode;
    response = {
      success: false,
      error: {
        code: error.code || 'REQUEST_ERROR',
        message: error.message,
      },
    };
  } else {
    statusCode = 500;
    response = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message,
      },
    };
  }

  reply.status(statusCode).send(response);
}
