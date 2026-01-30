export type UserRole = 'ADMIN' | 'BRANCH_LEADER';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'ON_SITE' | 'COMPLETED' | 'CANCELLED';

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface User {
    email: string;
    orgId: string;
    orgName: string;
    role: UserRole;
    branchId?: string | null;
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
    isActive: boolean;
}

export interface Customer {
    id: string;
    name: string;
    phone: string;
    address?: string | null;
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
    invoice?: Invoice | null;
    createdAt: string;
    updatedAt: string;
}

export interface Invoice {
    id: string;
    amount: number;
    paymentStatus: PaymentStatus;
    paymentMethod?: string | null;
    bookingId: string;
    booking?: Booking;
    issuedAt: string;
    paidAt?: string | null;
}

export interface InventoryItem {
    id: string;
    name: string;
    sku?: string | null;
    branchId: string;
    branch?: Branch;
    quantity: number;
    unitCost?: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface InventoryTransaction {
    id: string;
    itemId: string;
    item?: InventoryItem;
    bookingId?: string | null;
    booking?: Booking | null;
    change: number;
    description?: string | null;
    createdAt: string;
}

export interface PublicBranch {
    id: string;
    name: string;
    location?: string | null;
    organizationName: string;
}
