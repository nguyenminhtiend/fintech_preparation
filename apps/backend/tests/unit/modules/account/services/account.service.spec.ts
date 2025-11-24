import { beforeEach, describe, expect, it } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import { type AccountEntity } from '@modules/account/interfaces/account.entity';
import { type IAccountRepository } from '@modules/account/repositories/account.repository';
import { AccountService, type CreateAccountInput } from '@modules/account/services/account.service';
import { NotFoundError } from '@shared/utils';

describe('AccountService - Unit Tests', () => {
  const mockAccountRepository = mockDeep<IAccountRepository>();
  let accountService: AccountService;

  beforeEach(() => {
    mockReset(mockAccountRepository);
    accountService = new AccountService(mockAccountRepository);
  });

  describe('createAccount', () => {
    const mockAccountEntity: AccountEntity = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      customerId: 'cust-001',
      accountNumber: '1234567890',
      balance: BigInt(0),
      availableBalance: BigInt(0),
      currency: 'USD',
      version: 1,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    const createAccountInput: CreateAccountInput = {
      customerId: 'cust-001',
      currency: 'USD',
    };

    it('should create an account with a unique account number', async () => {
      // Arrange
      mockAccountRepository.findByAccountNumber.mockResolvedValue(null);
      mockAccountRepository.create.mockResolvedValue(mockAccountEntity);

      // Act
      const result = await accountService.createAccount(createAccountInput);

      // Assert
      expect(result).toEqual(mockAccountEntity);
      expect(mockAccountRepository.findByAccountNumber).toHaveBeenCalledOnce();
      expect(mockAccountRepository.create).toHaveBeenCalledOnce();
      expect(mockAccountRepository.create).toHaveBeenCalledWith({
        customerId: createAccountInput.customerId,
        accountNumber: expect.any(String),
        currency: createAccountInput.currency,
      });
    });

    it('should generate a 10-digit account number', async () => {
      // Arrange
      mockAccountRepository.findByAccountNumber.mockResolvedValue(null);
      mockAccountRepository.create.mockResolvedValue(mockAccountEntity);

      // Act
      await accountService.createAccount(createAccountInput);

      // Assert
      const createCall = mockAccountRepository.create.mock.calls[0][0];
      expect(createCall.accountNumber).toMatch(/^\d{10}$/);
      expect(Number(createCall.accountNumber)).toBeGreaterThanOrEqual(1000000000);
      expect(Number(createCall.accountNumber)).toBeLessThanOrEqual(9999999999);
    });

    it('should retry account creation when account number already exists', async () => {
      // Arrange
      const existingAccount: AccountEntity = {
        ...mockAccountEntity,
        accountNumber: '1111111111',
      };

      const newAccount: AccountEntity = {
        ...mockAccountEntity,
        accountNumber: '2222222222',
      };

      // First call finds existing account, second call finds none
      mockAccountRepository.findByAccountNumber
        .mockResolvedValueOnce(existingAccount)
        .mockResolvedValueOnce(null);

      mockAccountRepository.create.mockResolvedValue(newAccount);

      // Act
      const result = await accountService.createAccount(createAccountInput);

      // Assert
      expect(result).toEqual(newAccount);
      expect(mockAccountRepository.findByAccountNumber).toHaveBeenCalledTimes(2);
      expect(mockAccountRepository.create).toHaveBeenCalledOnce();
    });

    it('should handle multiple retries for duplicate account numbers', async () => {
      // Arrange
      const existingAccount: AccountEntity = {
        ...mockAccountEntity,
        accountNumber: '1111111111',
      };

      const finalAccount: AccountEntity = {
        ...mockAccountEntity,
        accountNumber: '3333333333',
      };

      // First three calls find existing accounts, fourth call finds none
      mockAccountRepository.findByAccountNumber
        .mockResolvedValueOnce(existingAccount)
        .mockResolvedValueOnce(existingAccount)
        .mockResolvedValueOnce(existingAccount)
        .mockResolvedValueOnce(null);

      mockAccountRepository.create.mockResolvedValue(finalAccount);

      // Act
      const result = await accountService.createAccount(createAccountInput);

      // Assert
      expect(result).toEqual(finalAccount);
      expect(mockAccountRepository.findByAccountNumber).toHaveBeenCalledTimes(4);
      expect(mockAccountRepository.create).toHaveBeenCalledOnce();
    });

    it('should create accounts with different currencies', async () => {
      // Arrange
      const eurInput: CreateAccountInput = {
        customerId: 'cust-002',
        currency: 'EUR',
      };

      const eurAccount: AccountEntity = {
        ...mockAccountEntity,
        customerId: 'cust-002',
        currency: 'EUR',
      };

      mockAccountRepository.findByAccountNumber.mockResolvedValue(null);
      mockAccountRepository.create.mockResolvedValue(eurAccount);

      // Act
      const result = await accountService.createAccount(eurInput);

      // Assert
      expect(result.currency).toBe('EUR');
      expect(mockAccountRepository.create).toHaveBeenCalledWith({
        customerId: eurInput.customerId,
        accountNumber: expect.any(String),
        currency: 'EUR',
      });
    });

    it('should create accounts for different customers', async () => {
      // Arrange
      const customer1Input: CreateAccountInput = {
        customerId: 'cust-001',
        currency: 'USD',
      };

      const customer2Input: CreateAccountInput = {
        customerId: 'cust-002',
        currency: 'USD',
      };

      mockAccountRepository.findByAccountNumber.mockResolvedValue(null);
      mockAccountRepository.create
        .mockResolvedValueOnce({ ...mockAccountEntity, customerId: 'cust-001' })
        .mockResolvedValueOnce({ ...mockAccountEntity, customerId: 'cust-002' });

      // Act
      const result1 = await accountService.createAccount(customer1Input);
      const result2 = await accountService.createAccount(customer2Input);

      // Assert
      expect(result1.customerId).toBe('cust-001');
      expect(result2.customerId).toBe('cust-002');
      expect(mockAccountRepository.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAccountBalance', () => {
    const mockAccountEntity: AccountEntity = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      customerId: 'cust-001',
      accountNumber: '1234567890',
      balance: BigInt(100000),
      availableBalance: BigInt(95000),
      currency: 'USD',
      version: 1,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };

    it('should return account with balance when account exists', async () => {
      // Arrange
      const accountId = '123e4567-e89b-12d3-a456-426614174000';
      mockAccountRepository.findById.mockResolvedValue(mockAccountEntity);

      // Act
      const result = await accountService.getAccountBalance(accountId);

      // Assert
      expect(result).toEqual(mockAccountEntity);
      expect(result.balance).toBe(BigInt(100000));
      expect(result.availableBalance).toBe(BigInt(95000));
      expect(mockAccountRepository.findById).toHaveBeenCalledOnce();
      expect(mockAccountRepository.findById).toHaveBeenCalledWith(accountId);
    });

    it('should throw NotFoundError when account does not exist', async () => {
      // Arrange
      const accountId = 'non-existent-id';
      mockAccountRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(accountService.getAccountBalance(accountId)).rejects.toThrow(NotFoundError);
      await expect(accountService.getAccountBalance(accountId)).rejects.toThrow(
        'Account not found',
      );
      expect(mockAccountRepository.findById).toHaveBeenCalledWith(accountId);
    });

    it('should return account with zero balance for new accounts', async () => {
      // Arrange
      const newAccount: AccountEntity = {
        ...mockAccountEntity,
        balance: BigInt(0),
        availableBalance: BigInt(0),
      };

      mockAccountRepository.findById.mockResolvedValue(newAccount);

      // Act
      const result = await accountService.getAccountBalance(newAccount.id);

      // Assert
      expect(result.balance).toBe(BigInt(0));
      expect(result.availableBalance).toBe(BigInt(0));
    });

    it('should handle different account IDs correctly', async () => {
      // Arrange
      const accountId1 = '123e4567-e89b-12d3-a456-426614174001';
      const accountId2 = '123e4567-e89b-12d3-a456-426614174002';

      const account1: AccountEntity = {
        ...mockAccountEntity,
        id: accountId1,
        balance: BigInt(50000),
      };

      const account2: AccountEntity = {
        ...mockAccountEntity,
        id: accountId2,
        balance: BigInt(75000),
      };

      mockAccountRepository.findById
        .mockResolvedValueOnce(account1)
        .mockResolvedValueOnce(account2);

      // Act
      const result1 = await accountService.getAccountBalance(accountId1);
      const result2 = await accountService.getAccountBalance(accountId2);

      // Assert
      expect(result1.id).toBe(accountId1);
      expect(result1.balance).toBe(BigInt(50000));
      expect(result2.id).toBe(accountId2);
      expect(result2.balance).toBe(BigInt(75000));
      expect(mockAccountRepository.findById).toHaveBeenCalledTimes(2);
    });

    it('should return complete account entity with all properties', async () => {
      // Arrange
      mockAccountRepository.findById.mockResolvedValue(mockAccountEntity);

      // Act
      const result = await accountService.getAccountBalance(mockAccountEntity.id);

      // Assert
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('customerId');
      expect(result).toHaveProperty('accountNumber');
      expect(result).toHaveProperty('balance');
      expect(result).toHaveProperty('availableBalance');
      expect(result).toHaveProperty('currency');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });
  });

  describe('generateAccountNumber (via createAccount)', () => {
    it('should generate different account numbers on subsequent calls', async () => {
      // Arrange
      const input: CreateAccountInput = {
        customerId: 'cust-001',
        currency: 'USD',
      };

      const accountNumbers = new Set<string>();

      mockAccountRepository.findByAccountNumber.mockResolvedValue(null);
      mockAccountRepository.create.mockImplementation(async (data) => ({
        id: '123e4567-e89b-12d3-a456-426614174000',
        customerId: data.customerId,
        accountNumber: data.accountNumber,
        balance: BigInt(0),
        availableBalance: BigInt(0),
        currency: data.currency,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Act - Create multiple accounts and collect account numbers
      for (let i = 0; i < 10; i++) {
        const result = await accountService.createAccount(input);
        accountNumbers.add(result.accountNumber);
      }

      // Assert - With very high probability, we should have at least some unique numbers
      // (Though not guaranteed due to randomness, the probability of 10 identical numbers is extremely low)
      expect(accountNumbers.size).toBeGreaterThan(1);
    });

    it('should generate account numbers within valid range', async () => {
      // Arrange
      const input: CreateAccountInput = {
        customerId: 'cust-001',
        currency: 'USD',
      };

      mockAccountRepository.findByAccountNumber.mockResolvedValue(null);
      mockAccountRepository.create.mockImplementation(async (data) => ({
        id: '123e4567-e89b-12d3-a456-426614174000',
        customerId: data.customerId,
        accountNumber: data.accountNumber,
        balance: BigInt(0),
        availableBalance: BigInt(0),
        currency: data.currency,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Act & Assert - Test multiple generations
      for (let i = 0; i < 20; i++) {
        const result = await accountService.createAccount(input);
        const accountNumber = Number(result.accountNumber);

        expect(accountNumber).toBeGreaterThanOrEqual(1000000000);
        expect(accountNumber).toBeLessThanOrEqual(9999999999);
        expect(result.accountNumber).toMatch(/^\d{10}$/);
      }
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle repository errors during account creation', async () => {
      // Arrange
      const input: CreateAccountInput = {
        customerId: 'cust-001',
        currency: 'USD',
      };

      const error = new Error('Database connection failed');
      mockAccountRepository.findByAccountNumber.mockRejectedValue(error);

      // Act & Assert
      await expect(accountService.createAccount(input)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle repository errors during balance retrieval', async () => {
      // Arrange
      const accountId = '123e4567-e89b-12d3-a456-426614174000';
      const error = new Error('Database connection failed');
      mockAccountRepository.findById.mockRejectedValue(error);

      // Act & Assert
      await expect(accountService.getAccountBalance(accountId)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle empty string account ID', async () => {
      // Arrange
      mockAccountRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(accountService.getAccountBalance('')).rejects.toThrow(NotFoundError);
    });

    it('should handle special characters in customer ID during account creation', async () => {
      // Arrange
      const input: CreateAccountInput = {
        customerId: 'cust-!@#$%',
        currency: 'USD',
      };

      const mockAccount: AccountEntity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        customerId: 'cust-!@#$%',
        accountNumber: '1234567890',
        balance: BigInt(0),
        availableBalance: BigInt(0),
        currency: 'USD',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAccountRepository.findByAccountNumber.mockResolvedValue(null);
      mockAccountRepository.create.mockResolvedValue(mockAccount);

      // Act
      const result = await accountService.createAccount(input);

      // Assert
      expect(result.customerId).toBe('cust-!@#$%');
    });
  });
});
