export interface DatabaseConfig {
  url: string;
  pool: {
    min: number;
    max: number;
  };
  log: boolean;
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    url: process.env.DATABASE_URL || '',
    pool: {
      min: 2,
      max: 10
    },
    log: process.env.NODE_ENV === 'development'
  };
}
