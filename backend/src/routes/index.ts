import { Router } from 'express';
import { login } from '../controllers/authController';
import {
    getBookings,
    createBooking,
    updateBooking,
    getBookingById,
    deleteBooking,
} from '../controllers/bookingController';
import { getCustomers, createCustomer } from '../controllers/customerController';
import { getInvoices, createInvoice, updatePaymentStatus } from '../controllers/invoiceController';
import {
    getTechnicians,
    createTechnician,
    updateTechnician,
    deleteTechnician,
    getBranches,
} from '../controllers/technicianController';
import { getPublicBranches, createPublicBooking } from '../controllers/publicController';
import authenticate from '../middleware/auth';
import { catchAsync } from '../middleware/errorHandler';
import { loginRateLimiter, publicBookingRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// --- Public routes (no auth) ------------------------------------------------
router.post('/auth/login', loginRateLimiter, catchAsync(login));
router.get('/public/branches', catchAsync(getPublicBranches));
router.post('/public/bookings', publicBookingRateLimiter, catchAsync(createPublicBooking));

// --- Everything below requires a valid token --------------------------------
router.use(authenticate);

// Bookings
router.get('/bookings', catchAsync(getBookings));
router.post('/bookings', catchAsync(createBooking));
router.get('/bookings/:id', catchAsync(getBookingById));
// PATCH is the canonical verb (partial update); PUT is kept as an alias so any
// older client stays working.
router.patch('/bookings/:id', catchAsync(updateBooking));
router.put('/bookings/:id', catchAsync(updateBooking));
router.delete('/bookings/:id', catchAsync(deleteBooking));

// Customers
router.get('/customers', catchAsync(getCustomers));
router.post('/customers', catchAsync(createCustomer));

// Invoices
router.get('/invoices', catchAsync(getInvoices));
router.post('/invoices', catchAsync(createInvoice));
router.patch('/invoices/:id/payment', catchAsync(updatePaymentStatus));

// Technicians & branches
router.get('/technicians', catchAsync(getTechnicians));
router.post('/technicians', catchAsync(createTechnician));
router.patch('/technicians/:id', catchAsync(updateTechnician));
router.delete('/technicians/:id', catchAsync(deleteTechnician));
router.get('/branches', catchAsync(getBranches));

export default router;
