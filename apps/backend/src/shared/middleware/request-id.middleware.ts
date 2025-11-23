import { randomUUID } from 'crypto';
import { type NextFunction, type Request, type Response } from 'express';

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
  req.headers['x-request-id'] = requestId as string;
  res.setHeader('x-request-id', requestId);
  next();
};
