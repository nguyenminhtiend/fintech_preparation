import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export class TestDatabase {
  private static instance: PrismaClient | null = null;
  private static testDatabaseUrl: string;

  static async setup(): Promise<PrismaClient> {
    if (this.instance) {
      return this.instance;
    }

    const baseUrl = process.env.DATABASE_URL;
    console.log('baseUrl', baseUrl);
    if (!baseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    this.testDatabaseUrl = baseUrl.replace(/\/([^/]+)(\?|$)/, '/$1_test$2');

    process.env.DATABASE_URL = this.testDatabaseUrl;

    const adapter = new PrismaPg({ connectionString: this.testDatabaseUrl });

    this.instance = new PrismaClient({
      adapter,
      log: ['error', 'warn'],
    });

    await this.instance.$connect();

    return this.instance;
  }

  static async cleanDatabase(): Promise<void> {
    if (!this.instance) {
      throw new Error('Database not initialized. Call setup() first.');
    }

    const tablenames = await this.instance.$queryRaw<
      { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== '_prisma_migrations')
      .map((name) => `"public"."${name}"`)
      .join(', ');

    if (tables.length > 0) {
      try {
        await this.instance.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
      } catch (error) {
        console.error('Error cleaning database:', error);
        throw error;
      }
    }
  }

  static async teardown(): Promise<void> {
    if (this.instance) {
      await this.instance.$disconnect();
      this.instance = null;
    }
  }

  static getInstance(): PrismaClient {
    if (!this.instance) {
      throw new Error('Database not initialized. Call setup() first.');
    }
    return this.instance;
  }

  static async reset(): Promise<void> {
    await this.cleanDatabase();
  }
}
