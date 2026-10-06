export type UserRole = 'ADMIN' | 'BRANCH_LEADER';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'ON_SITE' | 'COMPLETED' | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface User {
    email: string;
    orgId: string;
    orgName: string;
    role: UserRole;
    branchId?: string | null;
    branchName?: string | null;
}

export interface Branch {
    id: string;
    name: string;
    location?: string | null;
}

export interface Technician {
    id: string;
    name: string;
    phone?: string | null;
    branchId: string;
    branch?: Branch;
    isActive: boolean;
}

export interface Customer {
    id: string;
    name: string;
    phone: string;
    address?: string | null;
    email?: string | null;
    type?: string;
    contactPerson?: string | null;
    /** Present on the list endpoint, which selects a bookings count. */
    _count?: { bookings: number };
}

export interface ServiceSite {
    id: string;
    customerId: string;
    branchId: string;
    customer?: Customer;
    branch?: Branch;
    name: string;
    address: string;
    contactName?: string | null;
    phone?: string | null;
    accessNotes?: string | null;
    isActive: boolean;
}

export interface Unit {
    id: string;
    customerId: string;
    customer?: Customer;
    name: string;
    brand?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    type: string;
    capacity?: string | null;
    location?: string | null;
    installedAt?: string | null;
    nextMaintenanceAt?: string | null;
    notes?: string | null;
    serviceSiteId?: string | null;
    serviceSite?: ServiceSite | null;
    bookings?: Booking[];
}

export interface InventoryItem {
    id: string;
    branchId: string;
    branch?: Branch;
    name: string;
    sku: string;
    unit: string;
    quantityOnHand: number;
    reorderLevel: number;
    unitCost: string | number;
}

export type InspectionOutcome = 'PENDING' | 'PASS' | 'FOLLOW_UP' | 'NOT_APPLICABLE';

/**
 * `checked` is retained for persisted checklist rows written by older clients.
 * New rows include `outcome`; when both fields exist, `checked` is the legacy
 * projection of whether the outcome is PASS.
 */
export interface InspectionItem {
    id: string;
    label: string;
    type?: 'CHECK' | 'MEASUREMENT';
    unitLabel?: string | null;
    reading?: string | null;
    outcome?: InspectionOutcome;
    checked?: boolean;
}
export interface BookingPart { id: string; quantity: number; unitPrice: string | number; unitPriceCents?: number; inventoryItem: InventoryItem }
export interface Payment { id: string; amount: string | number; method: string; reference?: string | null; paidAt?: string; createdAt: string }

export interface Booking {
    id: string;
    serviceType: string;
    status: BookingStatus;
    scheduledAt: string;
    customerId: string;
    customer?: Customer;
    branchId: string;
    branch?: Branch;
    technicianId?: string | null;
    technician?: Technician | null;
    estimateRevisionId?: string | null;
    estimateRevision?: EstimateRevision | null;
    serviceRequest?: Pick<ServiceRequest, 'reportedIssue' | 'preferredWindowStart' | 'preferredWindowEnd' | 'accessNotes'> | null;
    serviceSiteId?: string | null;
    serviceSite?: ServiceSite | null;
    serviceAddress?: string | null;
    accessNotes?: string | null;
    inspectionTemplateId?: string | null;
    notes?: string | null;
    invoice?: Invoice | null;
    createdAt: string;
    updatedAt: string;
    unitId?: string | null;
    unit?: Unit | null;
    durationMinutes?: number;
    priority?: 'NORMAL' | 'HIGH' | 'URGENT';
    diagnosis?: string | null;
    checklist?: InspectionItem[];
    parts?: BookingPart[];
}

export interface Invoice {
    id: string;
    /**
     * Money is Decimal(12,2) in Postgres, which Prisma serialises to a JSON
     * *string* to avoid float precision loss. Always wrap reads in Number().
     */
    amount: string | number;
    paymentStatus: PaymentStatus;
    paymentMethod?: string | null;
    bookingId: string;
    booking?: Booking;
    issuedAt: string;
    paidAt?: string | null;
    amountPaid?: string | number | null;
    balance?: string | number | null;
    payments?: Payment[];
    lineItems?: InvoiceLine[];
    needsReview?: boolean;
    legacyBaseline?: boolean;
}

export interface InvoiceLine {
    id: string;
    sourceLineId?: string | null;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    lineTotal: string | number;
    sortOrder: number;
}

export type ServiceRequestStatus = 'NEW' | 'NEEDS_ASSESSMENT' | 'READY_TO_SCHEDULE' | 'CONVERTED' | 'CLOSED';
export type EstimateStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'DECLINED';
export type EstimateApprovalMethod = 'PHONE' | 'IN_PERSON' | 'EMAIL' | 'OTHER';

export const ALLOWED_SERVICE_REQUEST_TRANSITIONS: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
    NEW: ['NEEDS_ASSESSMENT', 'READY_TO_SCHEDULE', 'CLOSED'],
    NEEDS_ASSESSMENT: ['READY_TO_SCHEDULE', 'CLOSED'],
    READY_TO_SCHEDULE: ['NEEDS_ASSESSMENT', 'CLOSED'],
    CONVERTED: [],
    CLOSED: [],
};

export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
    NEW: 'New',
    NEEDS_ASSESSMENT: 'Needs assessment',
    READY_TO_SCHEDULE: 'Ready to schedule',
    CONVERTED: 'Converted',
    CLOSED: 'Closed',
};

export interface EstimateLineItem {
    id: string;
    revisionId: string;
    description: string;
    quantity: string | number;
    unitPrice: string | number;
    lineTotal: string | number;
    sortOrder: number;
    createdAt: string;
}

export interface EstimateRevision {
    id: string;
    estimateId: string;
    revisionNumber: number;
    status: EstimateStatus;
    notes?: string | null;
    sentAt?: string | null;
    approvedAt?: string | null;
    approvalMethod?: EstimateApprovalMethod | null;
    approvalContact?: string | null;
    approvalNote?: string | null;
    decisionNote?: string | null;
    approvedByUserId?: string | null;
    createdByUserId: string;
    supersededAt?: string | null;
    createdAt: string;
    total: string;
    lineItems: EstimateLineItem[];
}

export interface Estimate {
    id: string;
    serviceRequestId: string;
    revisions: EstimateRevision[];
    createdAt: string;
    updatedAt: string;
}

export interface ServiceRequest {
    id: string;
    status: ServiceRequestStatus;
    serviceType: string;
    priority: 'NORMAL' | 'HIGH' | 'URGENT';
    reportedIssue: string;
    serviceAddress: string;
    preferredWindowStart?: string | null;
    preferredWindowEnd?: string | null;
    accessNotes?: string | null;
    internalNotes?: string | null;
    organizationId: string;
    branchId: string;
    branch?: Branch;
    customerId: string;
    customer?: Customer;
    serviceSiteId?: string | null;
    serviceSite?: ServiceSite | null;
    unitId?: string | null;
    unit?: Unit | null;
    createdByUserId: string;
    booking?: Pick<Booking, 'id' | 'status' | 'scheduledAt'> | null;
    estimate?: Estimate | null;
    createdAt: string;
    updatedAt: string;
}

export interface InspectionTemplateItem {
    id: string;
    templateId: string;
    label: string;
    type: 'CHECK' | 'MEASUREMENT';
    unitLabel?: string | null;
    sortOrder: number;
    createdAt: string;
}

export interface InspectionTemplate {
    id: string;
    name: string;
    serviceType: string;
    isActive: boolean;
    organizationId: string;
    createdByUserId: string;
    items: InspectionTemplateItem[];
    createdAt: string;
    updatedAt: string;
}

export interface PartsUsageReportRow {
    id: string;
    quantity: number;
    createdAt: string;
    unitCost: string;
    extendedCost: string;
    inventoryItem: Pick<InventoryItem, 'name' | 'sku' | 'unit'>;
    booking: Pick<Booking, 'id' | 'serviceType' | 'scheduledAt'> & {
        customer: Pick<Customer, 'name'>;
        branch: Pick<Branch, 'id' | 'name'>;
    };
}

export interface MaintenanceDueReportRow extends Unit {
    dueState: 'PAST_DUE' | 'DUE_TODAY' | 'UPCOMING';
    customer: Customer;
    serviceSite?: ServiceSite | null;
    _count: { bookings: number };
}

/** Envelope returned by every list endpoint. */
export interface Paginated<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
}

/**
 * BOOKING LIFECYCLE — mirrors backend/src/lib/bookingStatus.ts.
 *
 * The status dropdown used to offer all five values regardless of the current
 * state, so most selections were rejected by the API's state machine. Deriving
 * the options from this map means the UI can only ever offer a legal move.
 */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['ON_SITE', 'CANCELLED'],
    ON_SITE: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
};

export const STATUS_LABELS: Record<BookingStatus, string> = {
    PENDING: 'Pending',
    CONFIRMED: 'Confirmed',
    ON_SITE: 'On Site',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
};

export const PAYMENT_METHODS = ['CASH', 'E_WALLET', 'BANK', 'CHEQUE'] as const;

export const SERVICE_TYPES = ['Cleaning', 'Repair', 'Installation', 'Maintenance'] as const;
