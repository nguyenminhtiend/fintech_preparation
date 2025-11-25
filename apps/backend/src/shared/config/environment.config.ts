import { config } from 'dotenv';
import { z } from 'zod';

import { logger } from '../utils/logger.util.js';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
});

export type Environment = z.infer<typeof envSchema>;

function loadEnvironment(): Environment {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    logger.error({ errors: parsed.error.format() }, '❌ Invalid environment variables');
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

export const env = loadEnvironment();
