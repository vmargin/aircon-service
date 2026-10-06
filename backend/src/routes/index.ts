import { Router } from 'express';
import { login, me } from '../controllers/authController';
import {
    approveEstimate,
    convertServiceRequest,
    createServiceRequest,
    createServiceSite,
    declineEstimate,
    getServiceRequests,
    getServiceSites,
    saveServiceRequestEstimate,
    sendEstimate,
    updateServiceRequest,
    updateServiceSite,
} from '../controllers/serviceOpsController';
import { createInspectionTemplate, getInspectionTemplates, updateInspectionTemplate } from '../controllers/inspectionTemplateController';
import { getMaintenanceDueReport, getPartsUsageReport } from '../controllers/reportController';
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
import { getInventory, createInventoryItem, restockInventory, adjustInventory, useBookingPart } from '../controllers/inventoryController';
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

// Service locations and unscheduled intake
router.get('/service-sites', catchAsync(getServiceSites));
router.post('/service-sites', catchAsync(createServiceSite));
router.patch('/service-sites/:id', catchAsync(updateServiceSite));
router.get('/service-requests', catchAsync(getServiceRequests));
router.post('/service-requests', catchAsync(createServiceRequest));
router.patch('/service-requests/:id', catchAsync(updateServiceRequest));
router.post('/service-requests/:id/estimate', catchAsync(saveServiceRequestEstimate));
router.post('/service-requests/:id/convert', catchAsync(convertServiceRequest));
router.post('/estimate-revisions/:id/send', catchAsync(sendEstimate));
router.post('/estimate-revisions/:id/approve', catchAsync(approveEstimate));
router.post('/estimate-revisions/:id/decline', catchAsync(declineEstimate));

// Organization-wide inspection forms; only admins may author shared templates.
router.get('/inspection-templates', catchAsync(getInspectionTemplates));
router.post('/inspection-templates', catchAsync(createInspectionTemplate));
router.patch('/inspection-templates/:id', catchAsync(updateInspectionTemplate));

// Reports follow the scope of their source records. Maintenance dates are
// organization-wide for admins and limited to branch-owned service activity otherwise.
router.get('/reports/parts-usage', catchAsync(getPartsUsageReport));
router.get('/reports/maintenance-due', catchAsync(getMaintenanceDueReport));

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
router.post('/inventory/:id/adjustments', catchAsync(adjustInventory));
router.get('/overview', catchAsync(getOverview));
router.get('/activity', catchAsync(getActivity));

// Technicians & branches
router.get('/technicians', catchAsync(getTechnicians));
router.post('/technicians', catchAsync(createTechnician));
router.patch('/technicians/:id', catchAsync(updateTechnician));
router.delete('/technicians/:id', catchAsync(deleteTechnician));
router.get('/branches', catchAsync(getBranches));

export default router;
