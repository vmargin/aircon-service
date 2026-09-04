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
    /** Present on the list endpoint, which selects a bookings count. */
    _count?: { bookings: number };
}

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
    notes?: string | null;
    invoice?: Invoice | null;
    createdAt: string;
    updatedAt: string;
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
