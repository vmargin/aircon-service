// Update API routes to use /api/v1/ prefix
import { Router } from 'express';
import { authController } from './controllers/authController';
import { bookingController } from './controllers/bookingController';
import { customerController } from './controllers/customerController';
import { invoiceController } from './controllers/invoiceController';
import { technicianController } from './controllers/technicianController';
import { publicController } from './controllers/publicController';

const router = Router();

// API Version 1 routes
router.use('/api/v1', (req, res, next) => {
  // Log API version usage
  console.log(`API Version 1 accessed by ${req.ip}`);
  next();
});

// Auth routes
router.post('/api/v1/auth/login', authController.login);
router.post('/api/v1/auth/logout', authController.logout);
router.post('/api/v1/auth/refresh', authController.refresh);

// Booking routes
router.get('/api/v1/bookings', bookingController.getAllBookings);
router.post('/api/v1/bookings', bookingController.createBooking);
router.get('/api/v1/bookings/:id', bookingController.getBookingById);
router.put('/api/v1/bookings/:id', bookingController.updateBooking);
router.delete('/api/v1/bookings/:id', bookingController.deleteBooking);

// Customer routes
router.get('/api/v1/customers', customerController.getAllCustomers);
router.post('/api/v1/customers', customerController.createCustomer);
router.get('/api/v1/customers/:id', customerController.getCustomerById);
router.put('/api/v1/customers/:id', customerController.updateCustomer);
router.delete('/api/v1/customers/:id', customerController.deleteCustomer);

// Invoice routes
router.get('/api/v1/invoices', invoiceController.getAllInvoices);
router.post('/api/v1/invoices', invoiceController.createInvoice);
router.get('/api/v1/invoices/:id', invoiceController.getInvoiceById);
router.put('/api/v1/invoices/:id', invoiceController.updateInvoice);
router.delete('/api/v1/invoices/:id', invoiceController.deleteInvoice);

// Technician routes
router.get('/api/v1/technicians', technicianController.getAllTechnicians);
router.post('/api/v1/technicians', technicianController.createTechnician);
router.get('/api/v1/technicians/:id', technicianController.getTechnicianById);
router.put('/api/v1/technicians/:id', technicianController.updateTechnician);
router.delete('/api/v1/technicians/:id', technicianController.deleteTechnician);

// Public routes (no auth required)
router.post('/api/v1/public/book', publicController.publicBooking);
router.get('/api/v1/public/availability', publicController.checkAvailability);

// Health check route
router.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
});

export default router;