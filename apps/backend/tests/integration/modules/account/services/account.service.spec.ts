import { beforeEach, describe, expect, it } from 'vitest';

import { AccountRepository } from '@modules/account/repositories/account.repository';
import { AccountService } from '@modules/account/services/account.service';
import { NotFoundError } from '@shared/utils';

import { TestDatabase, TestFactories } from '../../../../helpers';

describe('AccountService - Integration Tests', () => {
  let accountService: AccountService;
  let accountRepository: AccountRepository;
  let testFactories: TestFactories;

  beforeEach(() => {
    const db = TestDatabase.getInstance();
    testFactories = new TestFactories(db);
    accountRepository = new AccountRepository(db);
    accountService = new AccountService(accountRepository);
  });

  describe('createAccount', () => {
    it('should successfully create a new account with valid data', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();
      const input = {
        customerId: customer.id,
        currency: 'USD',
      };

      // Act
      const account = await accountService.createAccount(input);

      // Assert
      expect(account).toBeDefined();
      expect(account.id).toBeDefined();
      expect(account.customerId).toBe(customer.id);
      expect(account.currency).toBe('USD');
      expect(account.accountNumber).toMatch(/^\d{10}$/);
      expect(account.balance).toBe(BigInt(0));
      expect(account.availableBalance).toBe(BigInt(0));
      expect(account.version).toBe(1);
      expect(account.createdAt).toBeInstanceOf(Date);
      expect(account.updatedAt).toBeInstanceOf(Date);
    });

    it('should create account with different currencies', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();

      // Act
      const usdAccount = await accountService.createAccount({
        customerId: customer.id,
        currency: 'USD',
      });

      const eurAccount = await accountService.createAccount({
        customerId: customer.id,
        currency: 'EUR',
      });

      const gbpAccount = await accountService.createAccount({
        customerId: customer.id,
        currency: 'GBP',
      });

      // Assert
      expect(usdAccount.currency).toBe('USD');
      expect(eurAccount.currency).toBe('EUR');
      expect(gbpAccount.currency).toBe('GBP');
    });

    it('should generate unique account numbers for multiple accounts', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();

      // Act - Create 5 accounts
      const accounts = await Promise.all(
        Array.from({ length: 5 }).map(() =>
          accountService.createAccount({
            customerId: customer.id,
            currency: 'USD',
          }),
        ),
      );

      // Assert
      const accountNumbers = accounts.map((acc) => acc.accountNumber);
      const uniqueNumbers = new Set(accountNumbers);
      expect(uniqueNumbers.size).toBe(5);
    });

    it('should handle account number collision by retrying', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();

      // Create an account first to force potential collision
      await accountService.createAccount({
        customerId: customer.id,
        currency: 'USD',
      });

      // Act - Create many accounts to potentially trigger collision handling
      const accounts = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          accountService.createAccount({
            customerId: customer.id,
            currency: 'USD',
          }),
        ),
      );

      // Assert - All accounts should be created successfully
      expect(accounts).toHaveLength(10);
      accounts.forEach((account) => {
        expect(account.id).toBeDefined();
        expect(account.accountNumber).toMatch(/^\d{10}$/);
      });
    });

    it('should create account without customerId (nullable)', async () => {
      // Arrange
      const input = {
        customerId: null as any,
        currency: 'USD',
      };

      // Act
      const account = await accountService.createAccount(input);

      // Assert
      expect(account).toBeDefined();
      expect(account.customerId).toBeNull();
      expect(account.accountNumber).toBeDefined();
    });

    it('should persist account to database and be retrievable', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();

      // Act
      const createdAccount = await accountService.createAccount({
        customerId: customer.id,
        currency: 'USD',
      });

      // Assert - Verify it's in the database
      const retrievedAccount = await accountRepository.findById(createdAccount.id);
      expect(retrievedAccount).toBeDefined();
      expect(retrievedAccount?.id).toBe(createdAccount.id);
      expect(retrievedAccount?.accountNumber).toBe(createdAccount.accountNumber);
    });
  });

  describe('getAccountBalance', () => {
    it('should successfully retrieve account with balance', async () => {
      // Arrange
      const { account } = await testFactories.createCustomerWithAccount();

      // Act
      const result = await accountService.getAccountBalance(account.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(account.id);
      expect(result.accountNumber).toBe(account.accountNumber);
      expect(result.balance).toBe(BigInt(0));
      expect(result.availableBalance).toBe(BigInt(0));
    });

    it('should retrieve account with non-zero balance', async () => {
      // Arrange
      const balance = BigInt(100000); // $1,000.00 in cents
      const availableBalance = BigInt(75000); // $750.00 in cents

      const { account } = await testFactories.createCustomerWithAccount(
        {},
        {
          balance,
          availableBalance,
        },
      );

      // Act
      const result = await accountService.getAccountBalance(account.id);

      // Assert
      expect(result.balance).toBe(balance);
      expect(result.availableBalance).toBe(availableBalance);
    });

    it('should throw NotFoundError when account does not exist', async () => {
      // Arrange
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // Act & Assert
      await expect(accountService.getAccountBalance(nonExistentId)).rejects.toThrow(NotFoundError);

      await expect(accountService.getAccountBalance(nonExistentId)).rejects.toThrow(
        'Account not found',
      );
    });

    it('should retrieve correct account data with all fields', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();
      const createdAccount = await accountService.createAccount({
        customerId: customer.id,
        currency: 'EUR',
      });

      // Act
      const result = await accountService.getAccountBalance(createdAccount.id);

      // Assert
      expect(result.id).toBe(createdAccount.id);
      expect(result.customerId).toBe(customer.id);
      expect(result.accountNumber).toBe(createdAccount.accountNumber);
      expect(result.currency).toBe('EUR');
      expect(result.version).toBe(1);
    });

    it('should handle multiple concurrent balance retrievals', async () => {
      // Arrange
      const { account } = await testFactories.createCustomerWithAccount();

      // Act - Retrieve balance concurrently multiple times
      const results = await Promise.all(
        Array.from({ length: 5 }).map(() => accountService.getAccountBalance(account.id)),
      );

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.id).toBe(account.id);
        expect(result.accountNumber).toBe(account.accountNumber);
      });
    });
  });

  describe('Edge Cases and Data Integrity', () => {
    it('should maintain data integrity across multiple operations', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();

      // Act - Create account and retrieve it multiple times
      const createdAccount = await accountService.createAccount({
        customerId: customer.id,
        currency: 'USD',
      });

      const retrieval1 = await accountService.getAccountBalance(createdAccount.id);
      const retrieval2 = await accountService.getAccountBalance(createdAccount.id);

      // Assert - Data should be consistent
      expect(retrieval1.accountNumber).toBe(createdAccount.accountNumber);
      expect(retrieval2.accountNumber).toBe(createdAccount.accountNumber);
      expect(retrieval1.version).toBe(retrieval2.version);
      expect(retrieval1.balance).toBe(retrieval2.balance);
    });

    it('should handle accounts for different customers independently', async () => {
      // Arrange
      const customer1 = await testFactories.createCustomer();
      const customer2 = await testFactories.createCustomer();

      // Act
      const account1 = await accountService.createAccount({
        customerId: customer1.id,
        currency: 'USD',
      });

      const account2 = await accountService.createAccount({
        customerId: customer2.id,
        currency: 'EUR',
      });

      // Assert
      expect(account1.customerId).toBe(customer1.id);
      expect(account2.customerId).toBe(customer2.id);
      expect(account1.id).not.toBe(account2.id);
      expect(account1.accountNumber).not.toBe(account2.accountNumber);

      // Verify retrievals work independently
      const retrieved1 = await accountService.getAccountBalance(account1.id);
      const retrieved2 = await accountService.getAccountBalance(account2.id);

      expect(retrieved1.customerId).toBe(customer1.id);
      expect(retrieved2.customerId).toBe(customer2.id);
    });

    it('should properly handle BigInt balance values', async () => {
      // Arrange - Test large balance values
      const largeBalance = BigInt('9999999999999999'); // Large amount

      const { account } = await testFactories.createCustomerWithAccount(
        {},
        {
          balance: largeBalance,
          availableBalance: largeBalance,
        },
      );

      // Act
      const result = await accountService.getAccountBalance(account.id);

      // Assert
      expect(result.balance).toBe(largeBalance);
      expect(result.availableBalance).toBe(largeBalance);
      expect(typeof result.balance).toBe('bigint');
      expect(typeof result.availableBalance).toBe('bigint');
    });
  });
});
