import { type PrismaClient } from '@prisma/client';
import { beforeEach, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// Mock the database module
vi.mock('@/shared/database', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

// Create a typed mock proxy
export const prismaMock = mockDeep<PrismaClient>();

// Reset mocks before each test
beforeEach(() => {
  mockReset(prismaMock);
});
