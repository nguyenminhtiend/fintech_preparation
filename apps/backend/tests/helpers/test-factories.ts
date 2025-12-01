import { faker } from '@faker-js/faker';
import { type PrismaClient } from '@prisma/client';

/**
 * Factory functions for creating test data
 * These help create consistent, realistic test data across integration tests
 */

export interface CreateTestCustomerOptions {
  userId?: string;
  customerCode?: string;
  status?: string;
  kycStatus?: string;
  riskScore?: number;
  addressLine1?: string;
  city?: string;
  country?: string;
}

export interface CreateTestAccountOptions {
  customerId?: string;
  currency?: string;
  accountNumber?: string;
  balance?: bigint;
  availableBalance?: bigint;
  status?: string;
}

export class TestFactories {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Create a test customer
   */
  async createCustomer(options: CreateTestCustomerOptions = {}) {
    return await this.db.customer.create({
      data: {
        customerCode: options.customerCode ?? `CUST${faker.string.alphanumeric(8).toUpperCase()}`,
        status: options.status ?? 'ACTIVE',
        kycStatus: options.kycStatus ?? 'VERIFIED',
        riskScore: options.riskScore ?? 0,
        addressLine1: options.addressLine1 ?? faker.location.streetAddress(),
        city: options.city ?? faker.location.city(),
        country: options.country ?? 'US',
      },
    });
  }

  /**
   * Create a test account
   */
  async createAccount(options: CreateTestAccountOptions = {}) {
    const accountNumber = options.accountNumber ?? this.generateAccountNumber();

    return await this.db.account.create({
      data: {
        customerId: options.customerId ?? null,
        accountNumber,
        currency: options.currency ?? 'USD',
        balance: options.balance ?? BigInt(0),
        availableBalance: options.availableBalance ?? BigInt(0),
        status: options.status ?? 'ACTIVE',
        version: 1,
      },
    });
  }

  /**
   * Create a customer with an account
   */
  async createCustomerWithAccount(
    customerOptions: CreateTestCustomerOptions = {},
    accountOptions: Omit<CreateTestAccountOptions, 'customerId'> = {},
  ) {
    const customer = await this.createCustomer(customerOptions);
    const account = await this.createAccount({
      ...accountOptions,
      customerId: customer.id,
    });

    return { customer, account };
  }

  /**
   * Generate a random account number
   */
  private generateAccountNumber(): string {
    const min = 1000000000;
    const max = 9999999999;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }
}
