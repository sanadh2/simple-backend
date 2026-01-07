import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { Logger } from '../utils/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }
}

export const correlationIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  Logger.runWithContext({ correlationId }, () => {
    next();
  });
};

