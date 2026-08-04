import prisma from '../db/prisma';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../types';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler';

/**
 * TENANT SCOPING HELPERS
 *
 * Every query must be constrained to the caller's organization, and further to
 * their branch when they are a BRANCH_LEADER. Doing this inline in each
 * controller meant it was possible to forget — and it was forgotten on the
 * write paths, letting an ADMIN of org A attach records to org B. These helpers
 * are the single place that rule lives.
 */

/** True when the caller only sees a single branch. */
export function isBranchScoped(user: AuthUser): user is AuthUser & { branchId: string } {
    return user.role === UserRole.BRANCH_LEADER && !!user.branchId;
}

/**
 * `where` fragment for models that reach a branch via a `branch` relation
 * (Booking, Technician).
 */
export function branchScopedWhere(user: AuthUser) {
    return isBranchScoped(user)
        ? { branchId: user.branchId, branch: { organizationId: user.orgId } }
        : { branch: { organizationId: user.orgId } };
}

/**
 * Resolve a branch that the caller is allowed to write to.
 * Throws rather than returning null so callers cannot ignore the result.
 */
export async function assertBranchInScope(user: AuthUser, branchId: string) {
    if (isBranchScoped(user) && branchId !== user.branchId) {
        throw new ForbiddenError('You can only act on your own branch');
    }

    const branch = await prisma.branch.findFirst({
        where: { id: branchId, organizationId: user.orgId },
    });

    if (!branch) throw new NotFoundError('Branch not found');
    return branch;
}

/** Resolve a customer belonging to the caller's organization. */
export async function assertCustomerInScope(user: AuthUser, customerId: string) {
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId: user.orgId },
    });

    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
}

/**
 * Resolve a technician the caller may assign: same organization always, and
 * same branch when the caller is branch-scoped.
 */
export async function assertTechnicianInScope(user: AuthUser, technicianId: string) {
    const technician = await prisma.technician.findFirst({
        where: { id: technicianId, branch: { organizationId: user.orgId } },
    });

    if (!technician) throw new NotFoundError('Technician not found');

    if (isBranchScoped(user) && technician.branchId !== user.branchId) {
        throw new ForbiddenError('Cannot assign a technician from another branch');
    }

    return technician;
}
