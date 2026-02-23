import { setupTestDatabase, getTestData, clearTestData } from './setup';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import supertest from 'supertest';
import app from '../../src/app';

const request = supertest(app);

beforeEach(async () => {
  await setupTestDatabase();
});

afterEach(async () => {
  await clearTestData();
});

describe('Booking Integration Tests', () => {
  let adminUser: any;
  let branchLeaderUser: any;
  let testData: any;

  beforeAll(async () => {
    testData = await getTestData();
    adminUser = testData.users.find((u: any) => u.role === 'ADMIN');
    branchLeaderUser = testData.users.find((u: any) => u.role === 'BRANCH_LEADER');
  });

  describe('Create Booking', () => {
    it('should create a new booking (admin)', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
          password: 'demo123',
        });

      const newBooking = {
        serviceType: 'Cleaning',
        scheduledAt: '2026-03-15T10:00:00Z',
        customerId: testData.customers[0].id,
        branchId: testData.branches[0].id,
        notes: 'Customer requested morning service',
        customerName: testData.customers[0].name,
        phone: testData.customers[0].phone,
        address: '123 Main St',
      };

      const response = await request
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .send(newBooking)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.serviceType).toBe('Cleaning');
      expect(response.body.status).toBe('PENDING');
      expect(response.body.customerId).toBe(newBooking.customerId);
      expect(response.body.branchId).toBe(newBooking.branchId);
      expect(response.body.customerName).toBe(newBooking.customerName);
      expect(response.body.phone).toBe(newBooking.phone);
      expect(response.body.address).toBe(newBooking.address);
      expect(response.body.notes).toBe(newBooking.notes);
    });

    it('should create a new booking (branch leader)', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'north@arctic.com',
          password: 'demo123',
        });

      const newBooking = {
        serviceType: 'Repair',
        scheduledAt: '2026-03-15T14:00:00Z',
        customerId: testData.customers[1].id,
        branchId: testData.branches[0].id,
        customerName: testData.customers[1].name,
        phone: testData.customers[1].phone,
        address: '456 Elm St',
      };

      const response = await request
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .send(newBooking)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.serviceType).toBe('Repair');
      expect(response.body.status).toBe('PENDING');
      expect(response.body.customerId).toBe(newBooking.customerId);
      expect(response.body.branchId).toBe(newBooking.branchId);
      expect(response.body.customerName).toBe(newBooking.customerName);
      expect(response.body.phone).toBe(newBooking.phone);
      expect(response.body.address).toBe(newBooking.address);
    });

    it('should validate booking data', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
          password: 'demo123',
        });

      const invalidBooking = {
        serviceType: '', // Required
        scheduledAt: 'invalid-date',
        customerId: 'invalid-id',
        branchId: 'invalid-id',
        customerName: 'Test Customer',
        phone: 'invalid-phone',
        address: 'Test Address',
      };

      const response = await request
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .send(invalidBooking)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('Get Bookings', () => {
    it('should get all bookings (admin)', async () => {
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
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('serviceType');
      expect(response.body[0]).toHaveProperty('status');
    });

    it('should get branch bookings (branch leader)', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'north@arctic.com',
          password: 'demo123',
        });

      const response = await request
        .get('/api/v1/bookings')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // All bookings should belong to north branch
      expect(response.body.every((b: any) => b.branchId === testData.branches[0].id)).toBe(true);
    });

    it('should get booking by ID', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
          password: 'demo123',
        });

      const existingBooking = testData.bookings[0];

      const response = await request
        .get(`/api/v1/bookings/${existingBooking.id}`)
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(existingBooking.id);
      expect(response.body.serviceType).toBe(existingBooking.serviceType);
      expect(response.body.status).toBe(existingBooking.status);
    });

    it('should return 404 for non-existent booking', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
          password: 'demo123',
        });

      const response = await request
        .get('/api/v1/bookings/invalid-id')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('Update Booking', () => {
    it('should update booking status (admin)', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
          password: 'demo123',
        });

      const existingBooking = testData.bookings[0];

      const updateData = {
        status: 'CONFIRMED',
        notes: 'Customer confirmed the booking',
      };

      const response = await request
        .put(`/api/v1/bookings/${existingBooking.id}`)
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(existingBooking.id);
      expect(response.body.status).toBe('CONFIRMED');
      expect(response.body.notes).toBe(updateData.notes);
    });

    it('should update booking technician (branch leader)', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'north@arctic.com',
          password: 'demo123',
        });

      const existingBooking = testData.bookings[0];
      const tech = testData.technicians.find((t: any) => t.branchId === existingBooking.branchId);

      const updateData = {
        technicianId: tech.id,
      };

      const response = await request
        .put(`/api/v1/bookings/${existingBooking.id}`)
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(existingBooking.id);
      expect(response.body.technicianId).toBe(updateData.technicianId);
    });

    it('should validate update data', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
          password: 'demo123',
        });

      const existingBooking = testData.bookings[0];

      const invalidUpdate = {
        status: 'INVALID_STATUS',
        scheduledAt: 'invalid-date',
      };

      const response = await request
        .put(`/api/v1/bookings/${existingBooking.id}`)
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .send(invalidUpdate)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation Error');
    });
  });

  describe('Delete Booking', () => {
    it('should delete booking (admin)', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@arctic.com',
          password: 'demo123',
        });

      const existingBooking = testData.bookings[0];

      const response = await request
        .delete(`/api/v1/bookings/${existingBooking.id}`)
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Booking deleted successfully');

      // Verify booking is deleted
      const getResponse = await request
        .get(`/api/v1/bookings/${existingBooking.id}`)
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(404);
    });

    it('should not allow non-admin to delete', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'north@arctic.com',
          password: 'demo123',
        });

      const existingBooking = testData.bookings[0];

      const response = await request
        .delete(`/api/v1/bookings/${existingBooking.id}`)
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Forbidden');
    });
  });

  describe('Authorization', () => {
    it('should enforce branch access', async () => {
      const loginResponse = await request
        .post('/api/v1/auth/login')
        .send({
          email: 'north@arctic.com',
          password: 'demo123',
        });

      // Try to access south branch booking
      const southBooking = testData.bookings.find((b: any) => b.branchId !== testData.branches[0].id);
      
      if (southBooking) {
        const response = await request
          .get(`/api/v1/bookings/${southBooking.id}`)
          .set('Authorization', `Bearer ${loginResponse.body.token}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Forbidden');
      }
    });
  });
});