import { setupTestDatabase, getTestData, clearTestData } from './setup';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import supertest from 'supertest';
import app from '../../src/app';

const request = supertest(app);

describe('Auth Integration Tests', () => {
  let adminUser: any;
  let branchLeaderUser: any;

  beforeEach(async () => {
    await setupTestDatabase();
    const testData = await getTestData();
    adminUser = testData.users.find((u: any) => u.role === 'ADMIN');
    branchLeaderUser = testData.users.find((u: any) => u.role === 'BRANCH_LEADER');
  });

  afterEach(async () => {
    await clearTestData();
  });

  describe('Login', () => {
    it('should allow admin login', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
          password: 'demo123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('admin@arctic.com');
      expect(response.body.user.role).toBe('ADMIN');
    });

    it('should allow branch leader login', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'north@arctic.com',
          password: 'demo123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('north@arctic.com');
      expect(response.body.user.role).toBe('BRANCH_LEADER');
    });

    it('should reject invalid credentials', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
          password: 'wrong-password',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject missing credentials', async () => {
      const response = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('Authorization', () => {
    it('should require authentication for protected routes', async () => {
      const response = await request
        .get('/api/v1/bookings')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Unauthorized');
    });

    it('should allow authorized access', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
          password: 'demo123',
        });

      const response = await request
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should limit login attempts', async () => {
      // Make 5 login attempts
      for (let i = 0; i < 5; i++) {
        await request
          .post('/api/v1/auth/login')
          .send({
            email: 'admin@arctic.com',
            password: 'wrong-password',
          })
          .expect(401);
      }

      // 6th attempt should be rate limited
      const response = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
          password: 'wrong-password',
        })
        .expect(429);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Too many login attempts. Please try again later.');
    });
  });
});