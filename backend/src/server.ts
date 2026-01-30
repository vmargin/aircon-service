import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { login } from './controllers/authController';
import { getBookings, createBooking, updateBooking } from './controllers/bookingController';
import { getInvoices, createInvoice, updatePaymentStatus } from './controllers/invoiceController';
import { getCustomers, createCustomer } from './controllers/customerController';
import { getTechnicians, getBranches } from './controllers/technicianController';
import { getInventory, createInventoryItem, getInventoryTransactions, createInventoryTransaction } from './controllers/inventoryController';
import { getPublicBranches, createPublicBooking } from './controllers/publicController';
import authenticate from './middleware/auth';

/**
 * EXPRESS SERVER SETUP (TypeScript Version)
 * 
 * Pivoted for Aircon Service Business.
 */

dotenv.config();

const app = express();

// MIDDLEWARE
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));

app.use(express.json());

// ROUTE DEFINITIONS

// Public Routes
app.post('/api/auth/login', login);
app.get('/api/public/branches', getPublicBranches);
app.post('/api/public/bookings', createPublicBooking);

// Protected Routes (RBAC enforced in controllers)
app.get('/api/bookings', authenticate, getBookings);
app.post('/api/bookings', authenticate, createBooking);
app.patch('/api/bookings/:id', authenticate, updateBooking);

// Invoice Routes
app.get('/api/invoices', authenticate, getInvoices);
app.post('/api/invoices', authenticate, createInvoice);
app.patch('/api/invoices/:id/payment', authenticate, updatePaymentStatus);

// Customer Routes
app.get('/api/customers', authenticate, getCustomers);
app.post('/api/customers', authenticate, createCustomer);

// Technician & Branch Routes
app.get('/api/technicians', authenticate, getTechnicians);
app.get('/api/branches', authenticate, getBranches);

// Inventory Routes
app.get('/api/inventory', authenticate, getInventory);
app.post('/api/inventory', authenticate, createInventoryItem);
app.get('/api/inventory/transactions', authenticate, getInventoryTransactions);
app.post('/api/inventory/transactions', authenticate, createInventoryTransaction);

// SERVER INIT
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
        console.log(`   Local: http://localhost:${PORT}`);
    }
});
