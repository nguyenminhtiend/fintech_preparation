import { type NextFunction, type Request, type Response } from 'express';
import { type z } from 'zod';

export function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const query = schema.parse(req.query) as z.infer<T>;
    Object.assign(req.query, query);
    next();
  };
}

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const params = schema.parse(req.params) as z.infer<T>;
    Object.assign(req.params, params);
    next();
  };
}
