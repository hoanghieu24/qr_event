import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('[Unhandled Error]', err?.message || err);

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Hệ thống đang bận. Vui lòng thử lại sau.' : err.message;

  res.status(statusCode).json({
    success: false,
    message,
  });
}
