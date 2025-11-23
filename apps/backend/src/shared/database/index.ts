import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.util.js';

interface QueryEvent {
  query: string;
  params: string;
  duration: number;
}

interface ErrorEvent {
  message: string;
}

interface WarnEvent {
  message: string;
}

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

  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e: QueryEvent) => {
      logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Query');
    });
  }

  prisma.$on('error', (e: ErrorEvent) => {
    logger.error({ message: e.message }, 'Database error');
  });

  prisma.$on('warn', (e: WarnEvent) => {
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
