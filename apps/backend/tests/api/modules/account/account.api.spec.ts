import { beforeEach, describe, expect, it } from 'vitest';

import { ApiMatchers, ApiTestHelper, TestDatabase, TestFactories } from '../../../helpers';

describe('Account API Tests', () => {
  let testFactories: TestFactories;

  beforeEach(() => {
    const db = TestDatabase.getInstance();
    testFactories = new TestFactories(db);
  });

  describe('POST /accounts - Create Account', () => {
    it('should successfully create a new account with valid data', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();
      const requestBody = {
        customerId: customer.id,
        currency: 'USD',
      };

      // Act
      const response = await ApiTestHelper.post('/accounts').send(requestBody).expect(201);

      // Assert
      ApiMatchers.expectSuccessResponse(response, 201);
      ApiMatchers.expectAccountStructure(response.body);

      expect(response.body.customerId).toBe(customer.id);
      expect(response.body.currency).toBe('USD');
      expect(response.body.accountNumber).toMatch(/^\d{10}$/);
      expect(response.body.balance).toBe(0); // BigInt converted to Number
      expect(response.body.availableBalance).toBe(0);
      expect(response.body.version).toBe(1);

      // Verify in database
      const db = TestDatabase.getInstance();
      const dbAccount = await db.account.findUnique({
        where: { id: response.body.id },
      });
      expect(dbAccount).toBeTruthy();
      expect(dbAccount?.accountNumber).toBe(response.body.accountNumber);
    });

    it('should create account with different currencies (USD, EUR, GBP)', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();

      // Act & Assert - USD
      const usdResponse = await ApiTestHelper.post('/accounts')
        .send({ customerId: customer.id, currency: 'usd' }) // lowercase to test toUpperCase
        .expect(201);
      expect(usdResponse.body.currency).toBe('USD');

      // Act & Assert - EUR
      const eurResponse = await ApiTestHelper.post('/accounts')
        .send({ customerId: customer.id, currency: 'eur' })
        .expect(201);
      expect(eurResponse.body.currency).toBe('EUR');

      // Act & Assert - GBP
      const gbpResponse = await ApiTestHelper.post('/accounts')
        .send({ customerId: customer.id, currency: 'gbp' })
        .expect(201);
      expect(gbpResponse.body.currency).toBe('GBP');
    });

    it('should return 400 when customerId is missing from request body', async () => {
      // Arrange
      const requestBody = {
        currency: 'USD',
        // Missing customerId
      };

      // Act
      const response = await ApiTestHelper.post('/accounts').send(requestBody).expect(400);

      // Assert
      ApiMatchers.expectErrorResponse(response, 400);
    });

    it('should return 400 when currency is missing', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();
      const requestBody = {
        customerId: customer.id,
        // Missing currency
      };

      // Act
      const response = await ApiTestHelper.post('/accounts').send(requestBody).expect(400);

      // Assert
      ApiMatchers.expectErrorResponse(response, 400);
    });

    it('should return 400 for invalid currency format (not 3 characters)', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();
      const requestBody = {
        customerId: customer.id,
        currency: 'INVALID', // More than 3 characters
      };

      // Act
      const response = await ApiTestHelper.post('/accounts').send(requestBody).expect(400);

      // Assert
      ApiMatchers.expectErrorResponse(response, 400);
    });

    it('should return 400 for invalid customerId format', async () => {
      // Arrange
      const requestBody = {
        customerId: 'not-a-uuid',
        currency: 'USD',
      };

      // Act
      const response = await ApiTestHelper.post('/accounts').send(requestBody).expect(400);

      // Assert
      ApiMatchers.expectErrorResponse(response, 400);
    });

    it('should handle multiple concurrent account creation requests', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();

      // Act - Create 5 accounts concurrently
      const requests = Array.from({ length: 5 }).map(() =>
        ApiTestHelper.post('/accounts').send({
          customerId: customer.id,
          currency: 'USD',
        }),
      );

      const responses = await Promise.all(requests);

      // Assert
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.accountNumber).toMatch(/^\d{10}$/);
      });

      // Verify all account numbers are unique
      const accountNumbers = responses.map((r) => r.body.accountNumber);
      const uniqueNumbers = new Set(accountNumbers);
      expect(uniqueNumbers.size).toBe(5);
    });

    it('should return 400 for empty request body', async () => {
      // Act
      const response = await ApiTestHelper.post('/accounts').send({}).expect(400);

      // Assert
      ApiMatchers.expectErrorResponse(response, 400);
    });

    it('should return 500 for malformed JSON (Express parsing error)', async () => {
      // Act
      const response = await ApiTestHelper.post('/accounts')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(500);

      // Assert - Malformed JSON causes Express body-parser to fail
      expect(response.status).toBe(500);
    });
  });

  describe('GET /accounts/:id/balance - Get Account Balance', () => {
    it('should successfully retrieve account balance for valid account', async () => {
      // Arrange
      const { account } = await testFactories.createCustomerWithAccount();

      // Act
      const response = await ApiTestHelper.get(`/accounts/${account.id}/balance`).expect(200);

      // Assert
      ApiMatchers.expectSuccessResponse(response, 200);

      // BalanceResponse only returns: balance, availableBalance, currency, version
      expect(response.body.balance).toBe(0);
      expect(response.body.availableBalance).toBe(0);
      expect(response.body.currency).toBe(account.currency);
      expect(response.body.version).toBe(1);

      // id and accountNumber are NOT in BalanceResponse
      expect(response.body.id).toBeUndefined();
      expect(response.body.accountNumber).toBeUndefined();
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
      const response = await ApiTestHelper.get(`/accounts/${account.id}/balance`).expect(200);

      // Assert - BigInt converted to Number in response
      expect(response.body.balance).toBe(Number(balance));
      expect(response.body.availableBalance).toBe(Number(availableBalance));
      expect(typeof response.body.balance).toBe('number');
      expect(typeof response.body.availableBalance).toBe('number');
    });

    it('should return 404 for non-existent account', async () => {
      // Arrange
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      // Act
      const response = await ApiTestHelper.get(`/accounts/${nonExistentId}/balance`).expect(404);

      // Assert
      ApiMatchers.expectErrorResponse(response, 404);
      // Response body.error could be string or array depending on error handler
    });

    it('should return 500 for invalid account ID format (database error)', async () => {
      // Arrange
      const invalidId = 'not-a-uuid';

      // Act - Invalid UUID causes database error
      const response = await ApiTestHelper.get(`/accounts/${invalidId}/balance`).expect(500);

      // Assert - Database validation error
      expect(response.status).toBe(500);
    });

    it('should retrieve correct account for different customers', async () => {
      // Arrange - Create accounts with different currencies to ensure different responses
      const { account: account1 } = await testFactories.createCustomerWithAccount(
        {},
        { currency: 'USD' },
      );
      const { account: account2 } = await testFactories.createCustomerWithAccount(
        {},
        { currency: 'EUR' },
      );

      // Act
      const response1 = await ApiTestHelper.get(`/accounts/${account1.id}/balance`).expect(200);
      const response2 = await ApiTestHelper.get(`/accounts/${account2.id}/balance`).expect(200);

      // Assert
      expect(response1.body.currency).toBe('USD');
      expect(response2.body.currency).toBe('EUR');

      // Responses should be different (different currencies)
      expect(response1.body.currency).not.toEqual(response2.body.currency);
    });

    it('should handle concurrent balance retrieval requests', async () => {
      // Arrange
      const { account } = await testFactories.createCustomerWithAccount();

      // Act - Retrieve balance concurrently 5 times
      const requests = Array.from({ length: 5 }).map(() =>
        ApiTestHelper.get(`/accounts/${account.id}/balance`),
      );

      const responses = await Promise.all(requests);

      // Assert
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.currency).toBe(account.currency);
        expect(response.body.balance).toBe(0);
      });
    });

    it('should return consistent data across multiple retrievals', async () => {
      // Arrange
      const { account } = await testFactories.createCustomerWithAccount();

      // Act
      const response1 = await ApiTestHelper.get(`/accounts/${account.id}/balance`).expect(200);
      const response2 = await ApiTestHelper.get(`/accounts/${account.id}/balance`).expect(200);
      const response3 = await ApiTestHelper.get(`/accounts/${account.id}/balance`).expect(200);

      // Assert - All responses should be identical
      expect(response1.body).toEqual(response2.body);
      expect(response2.body).toEqual(response3.body);
    });

    it('should properly convert BigInt values to Numbers', async () => {
      // Arrange
      const largeBalance = BigInt('999999999'); // Large but safe for Number

      const { account } = await testFactories.createCustomerWithAccount(
        {},
        {
          balance: largeBalance,
          availableBalance: largeBalance,
        },
      );

      // Act
      const response = await ApiTestHelper.get(`/accounts/${account.id}/balance`).expect(200);

      // Assert - BigInt converted to Number
      expect(response.body.balance).toBe(Number(largeBalance));
      expect(response.body.availableBalance).toBe(Number(largeBalance));
      expect(typeof response.body.balance).toBe('number');
      expect(typeof response.body.availableBalance).toBe('number');
    });
  });

  describe('API Error Handling and Edge Cases', () => {
    it('should return 404 for non-existent routes', async () => {
      // Act
      const response = await ApiTestHelper.get('/accounts/invalid-route').expect(404);

      // Assert
      expect(response.status).toBe(404);
    });

    it('should handle invalid HTTP methods on valid routes', async () => {
      // Act
      const response = await ApiTestHelper.delete('/accounts').expect(404);

      // Assert
      expect(response.status).toBe(404);
    });

    it('should set correct content-type headers', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();

      // Act
      const response = await ApiTestHelper.post('/accounts')
        .send({ customerId: customer.id, currency: 'USD' })
        .expect(201);

      // Assert
      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    it('should handle requests with extra unexpected fields', async () => {
      // Arrange
      const customer = await testFactories.createCustomer();

      // Act
      const response = await ApiTestHelper.post('/accounts')
        .send({
          customerId: customer.id,
          currency: 'USD',
          unexpectedField: 'should be ignored',
          anotherField: 123,
        })
        .expect(201);

      // Assert
      expect(response.body).not.toHaveProperty('unexpectedField');
      expect(response.body).not.toHaveProperty('anotherField');
    });
  });
});
