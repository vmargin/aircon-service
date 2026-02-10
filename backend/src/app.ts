import express from 'express';
import cors from 'cors';
import { login } from './controllers/authController';
import { getBookings, createBooking, updateBooking } from './controllers/bookingController';
import { getInvoices, createInvoice, updatePaymentStatus } from './controllers/invoiceController';
import { getCustomers, createCustomer } from './controllers/customerController';
import { getTechnicians, getBranches } from './controllers/technicianController';
import {
    getInventory,
    createInventoryItem,
    getInventoryTransactions,
    createInventoryTransaction,
} from './controllers/inventoryController';
import { getPublicBranches, createPublicBooking } from './controllers/publicController';
import authenticate from './middleware/auth';

export function createApp() {
    const app = express();

    // CORS: token-based auth (Authorization header) doesn't require credentials/cookies.
    // If FRONTEND_URL is not set, allow all origins.
    app.use(
        cors({
            origin: process.env.FRONTEND_URL || '*',
            credentials: false,
        }),
    );

    app.use(express.json());

    // Public Routes
    app.post('/api/auth/login', login);
    app.get('/api/public/branches', getPublicBranches);
    app.post('/api/public/bookings', createPublicBooking);

    // Protected Routes
    app.get('/api/bookings', authenticate, getBookings);
    app.post('/api/bookings', authenticate, createBooking);
    app.patch('/api/bookings/:id', authenticate, updateBooking);

    app.get('/api/invoices', authenticate, getInvoices);
    app.post('/api/invoices', authenticate, createInvoice);
    app.patch('/api/invoices/:id/payment', authenticate, updatePaymentStatus);

    app.get('/api/customers', authenticate, getCustomers);
    app.post('/api/customers', authenticate, createCustomer);

    app.get('/api/technicians', authenticate, getTechnicians);
    app.get('/api/branches', authenticate, getBranches);

    app.get('/api/inventory', authenticate, getInventory);
    app.post('/api/inventory', authenticate, createInventoryItem);
    app.get('/api/inventory/transactions', authenticate, getInventoryTransactions);
    app.post('/api/inventory/transactions', authenticate, createInventoryTransaction);

    return app;
}

