import type { Express } from 'express';
import request from 'supertest';

import { createApp } from '@/app';

/**
 * API Test Helper
 * Provides utilities for testing API endpoints through the full HTTP stack
 */
export class ApiTestHelper {
  private static appInstance: Express | null = null;

  /**
   * Get or create the Express app instance for testing
   * Reuses the same instance across tests for better performance
   */
  static getApp(): Express {
    this.appInstance ??= createApp();
    return this.appInstance;
  }

  /**
   * Get a supertest agent for making HTTP requests
   * @returns supertest agent
   */
  static getAgent() {
    return request(this.getApp());
  }

  /**
   * Create a POST request helper
   */
  static post(url: string) {
    return this.getAgent().post(url);
  }

  /**
   * Create a GET request helper
   */
  static get(url: string) {
    return this.getAgent().get(url);
  }

  /**
   * Create a PUT request helper
   */
  static put(url: string) {
    return this.getAgent().put(url);
  }

  /**
   * Create a PATCH request helper
   */
  static patch(url: string) {
    return this.getAgent().patch(url);
  }

  /**
   * Create a DELETE request helper
   */
  static delete(url: string) {
    return this.getAgent().delete(url);
  }

  /**
   * Reset the app instance (useful for tests that need a fresh app)
   */
  static reset() {
    this.appInstance = null;
  }
}

/**
 * API Response Matchers
 * Common assertion helpers for API responses
 */
export class ApiMatchers {
  /**
   * Check if response has standard error format
   */
  static expectErrorResponse(response: any, status: number, message?: string) {
    expect(response.status).toBe(status);
    expect(response.body).toHaveProperty('error');

    if (message) {
      expect(response.body.error).toContain(message);
    }
  }

  /**
   * Check if response has success format
   */
  static expectSuccessResponse(response: any, status = 200) {
    expect(response.status).toBe(status);
    expect(response.body).toBeDefined();
  }

  /**
   * Check if response has pagination metadata
   */
  static expectPaginatedResponse(response: any) {
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('meta');
    expect(response.body.meta).toHaveProperty('page');
    expect(response.body.meta).toHaveProperty('pageSize');
    expect(response.body.meta).toHaveProperty('total');
  }

  /**
   * Check if response matches account structure
   */
  static expectAccountStructure(account: any) {
    expect(account).toHaveProperty('id');
    expect(account).toHaveProperty('accountNumber');
    expect(account).toHaveProperty('currency');
    expect(account).toHaveProperty('balance');
    expect(account).toHaveProperty('availableBalance');
    expect(account).toHaveProperty('version');
    expect(account).toHaveProperty('createdAt');
    expect(account).toHaveProperty('updatedAt');
  }
}
