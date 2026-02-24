// API routes with /api/v1/ prefix
import { Router } from 'express';
import { login } from '../controllers/authController';
import { getBookings, createBooking, updateBooking, getBookingById, deleteBooking } from '../controllers/bookingController';
import { getCustomers, createCustomer } from '../controllers/customerController';
import { getInvoices, createInvoice, updatePaymentStatus } from '../controllers/invoiceController';
import { getTechnicians, createTechnician, updateTechnician, deleteTechnician, getBranches } from '../controllers/technicianController';
import { getPublicBranches, createPublicBooking } from '../controllers/publicController';
import authenticate from '../middleware/auth';
import { catchAsync } from '../middleware/errorHandler';
import { Request, Response } from 'express';

const router = Router();

// Public routes (no auth required)
router.post('/auth/login', catchAsync(login));
router.get('/public/branches', catchAsync(getPublicBranches));
router.post('/public/bookings', catchAsync(createPublicBooking));

// Booking routes (protected)
router.get('/bookings', authenticate, catchAsync(getBookings));
router.post('/bookings', authenticate, catchAsync(createBooking));
router.get('/bookings/:id', authenticate, catchAsync(getBookingById));
router.put('/bookings/:id', authenticate, catchAsync(updateBooking));
router.delete('/bookings/:id', authenticate, catchAsync(deleteBooking));

// Customer routes (protected)
router.get('/customers', authenticate, catchAsync(getCustomers));
router.post('/customers', authenticate, catchAsync(createCustomer));

// Invoice routes (protected)
router.get('/invoices', authenticate, catchAsync(getInvoices));
router.post('/invoices', authenticate, catchAsync(createInvoice));
router.patch('/invoices/:id/payment', authenticate, catchAsync(updatePaymentStatus));

// Technician & Branch routes (protected)
router.get('/technicians', authenticate, catchAsync(getTechnicians));
router.post('/technicians', authenticate, catchAsync(createTechnician));
router.patch('/technicians/:id', authenticate, catchAsync(updateTechnician));
router.delete('/technicians/:id', authenticate, catchAsync(deleteTechnician));
router.get('/branches', authenticate, catchAsync(getBranches));

// Health check route
router.get('/health', catchAsync(async (_req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
}));

export default router;