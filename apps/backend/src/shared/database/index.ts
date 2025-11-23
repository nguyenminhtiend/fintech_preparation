// apps/backend/src/shared/database/index.ts
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.util.js';

export type Database = PrismaClient;

let prisma: PrismaClient | null = null;

export function createDatabase(): PrismaClient {
  if (prisma) {
    return prisma;
  }

  prisma = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' }
    ]
  });

  // Log queries in development
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).$on('query', (e: any) => {
      logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Query');
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on('error', (e: any) => {
    logger.error({ message: e.message }, 'Database error');
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (prisma as any).$on('warn', (e: any) => {
    logger.warn({ message: e.message }, 'Database warning');
  });

  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
