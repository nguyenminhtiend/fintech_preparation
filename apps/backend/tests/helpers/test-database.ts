import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export class TestDatabase {
  private static instance: PrismaClient | null = null;
  private static testDatabaseUrl: string;

  /**
   * Initialize the test database connection
   * Connects to an existing test database (must be created and migrated beforehand)
   * Uses a separate test database to avoid conflicts with development data
   */
  static async setup(): Promise<PrismaClient> {
    if (this.instance) {
      return this.instance;
    }

    // Get the test database URL from environment or create one
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Create test database URL by appending _test suffix
    this.testDatabaseUrl = baseUrl.replace(/\/([^/]+)(\?|$)/, '/$1_test$2');

    // Set the test database URL for Prisma
    process.env.DATABASE_URL = this.testDatabaseUrl;

    const adapter = new PrismaPg({ connectionString: this.testDatabaseUrl });

    this.instance = new PrismaClient({
      adapter,
      log: ['error', 'warn'],
    });

    // Ensure database is connected
    await this.instance.$connect();

    return this.instance;
  }

  /**
   * Clean all data from tables (for test isolation)
   */
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

  /**
   * Disconnect and cleanup
   */
  static async teardown(): Promise<void> {
    if (this.instance) {
      await this.instance.$disconnect();
      this.instance = null;
    }
  }

  /**
   * Get the database instance
   */
  static getInstance(): PrismaClient {
    if (!this.instance) {
      throw new Error('Database not initialized. Call setup() first.');
    }
    return this.instance;
  }

  /**
   * Reset database - clean all data and reset sequences
   */
  static async reset(): Promise<void> {
    await this.cleanDatabase();
  }
}
