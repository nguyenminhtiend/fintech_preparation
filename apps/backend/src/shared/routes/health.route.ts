import { type Request, type Response, type Router } from 'express';

export function healthRoute(router: Router): void {
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });
}
