import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.util.js';

interface QueryEvent {
  query: string;
  params: string;
  duration: number;
}

interface WarnEvent {
  message: string;
}

const logConfig: Array<{ level: 'query' | 'error' | 'warn'; emit: 'event' }> = [
  { level: 'query', emit: 'event' },
  { level: 'error', emit: 'event' },
  { level: 'warn', emit: 'event' }
];

export type Database = PrismaClient<{ log: typeof logConfig }>;

let prisma: PrismaClient<{ log: typeof logConfig }> | null = null;

export function createDatabase(): PrismaClient<{ log: typeof logConfig }> {
  if (prisma) {
    return prisma;
  }

  prisma = new PrismaClient({
    log: logConfig
  });

  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e: QueryEvent) => {
      logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Query');
    });
  }

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
