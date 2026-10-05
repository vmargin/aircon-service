import { Router } from 'express';
import { login, me } from '../controllers/authController';
import {
    getBookings,
    createBooking,
    updateBooking,
    getBookingById,
    deleteBooking,
} from '../controllers/bookingController';
import {
    getCustomers,
    createCustomer,
    updateCustomer,
} from '../controllers/customerController';
import { getInvoices, createInvoice, updatePaymentStatus, recordPayment } from '../controllers/invoiceController';
import { getUnits, createUnit, updateUnit } from '../controllers/unitController';
import { getInventory, createInventoryItem, restockInventory, useBookingPart } from '../controllers/inventoryController';
import { getOverview, getActivity } from '../controllers/overviewController';
import {
    getTechnicians,
    createTechnician,
    updateTechnician,
    deleteTechnician,
    getBranches,
} from '../controllers/technicianController';
import authenticate from '../middleware/auth';
import { catchAsync } from '../middleware/errorHandler';
import { loginRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// --- Public (no auth) -------------------------------------------------------
router.post('/auth/login', loginRateLimiter, catchAsync(login));

// --- Everything below requires a valid token --------------------------------
router.use(authenticate);

// Lets the SPA re-validate a stored token on boot instead of trusting
// localStorage, which could hold a session the server has since rejected.
router.get('/auth/me', catchAsync(me));

// Bookings
router.get('/bookings', catchAsync(getBookings));
router.post('/bookings', catchAsync(createBooking));
router.get('/bookings/:id', catchAsync(getBookingById));
router.patch('/bookings/:id', catchAsync(updateBooking));
router.delete('/bookings/:id', catchAsync(deleteBooking));
router.post('/bookings/:id/parts', catchAsync(useBookingPart));

// Customers
router.get('/customers', catchAsync(getCustomers));
router.post('/customers', catchAsync(createCustomer));
router.patch('/customers/:id', catchAsync(updateCustomer));

// Invoices
router.get('/invoices', catchAsync(getInvoices));
router.post('/invoices', catchAsync(createInvoice));
router.patch('/invoices/:id/payment', catchAsync(updatePaymentStatus));
router.post('/invoices/:id/payments', catchAsync(recordPayment));

router.get('/units', catchAsync(getUnits));
router.post('/units', catchAsync(createUnit));
router.patch('/units/:id', catchAsync(updateUnit));
router.get('/inventory', catchAsync(getInventory));
router.post('/inventory', catchAsync(createInventoryItem));
router.patch('/inventory/:id/restock', catchAsync(restockInventory));
router.get('/overview', catchAsync(getOverview));
router.get('/activity', catchAsync(getActivity));

// Technicians & branches
router.get('/technicians', catchAsync(getTechnicians));
router.post('/technicians', catchAsync(createTechnician));
router.patch('/technicians/:id', catchAsync(updateTechnician));
router.delete('/technicians/:id', catchAsync(deleteTechnician));
router.get('/branches', catchAsync(getBranches));

export default router;
