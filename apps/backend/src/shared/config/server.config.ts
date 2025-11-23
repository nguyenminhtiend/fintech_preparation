// apps/backend/src/shared/config/server.config.ts
import { env } from './environment.config.js';

export interface ServerConfig {
  port: number;
  env: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
}

export function getServerConfig(): ServerConfig {
  return {
    port: env.PORT,
    env: env.NODE_ENV,
    cors: {
      origin: env.NODE_ENV === 'development' ? '*' : [],
      credentials: true
    }
  };
}
