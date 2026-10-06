import prisma from '../db/prisma';
import { UserRole, Prisma } from '@prisma/client';
import { AuthUser } from '../types';
import { ForbiddenError, NotFoundError, ValidationError } from '../middleware/errorHandler';

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
    if (user.role === UserRole.BRANCH_LEADER && !user.branchId) {
        throw new ForbiddenError('Branch access is not configured. Contact your administrator.');
    }
    return user.role === UserRole.BRANCH_LEADER;
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
 * Unit records have no branch column. A linked branch-owned service site is
 * authoritative; a unit without one is visible to a branch only when its
 * recorded service activity points exclusively to that branch.
 */
export function branchScopedUnitWhere(user: AuthUser): Prisma.UnitWhereInput {
    if (!isBranchScoped(user)) return {};

    const { branchId, orgId } = user;
    return {
        OR: [
            { serviceSite: { is: { organizationId: orgId, branchId } } },
            {
                AND: [
                    {
                        OR: [
                            { serviceSiteId: null },
                            { serviceSite: { is: { organizationId: orgId, branchId: null } } },
                        ],
                    },
                    {
                        OR: [
                            { bookings: { some: { branchId } } },
                            { serviceRequests: { some: { organizationId: orgId, branchId } } },
                        ],
                    },
                    { bookings: { none: { branchId: { not: branchId } } } },
                    { serviceRequests: { none: { branchId: { not: branchId } } } },
                ],
            },
        ],
    };
}

/** Keep a service-site ownership change from racing a new unit/job assignment. */
export async function lockServiceSiteForLink(db: Prisma.TransactionClient, serviceSiteId: string) {
    await db.$queryRaw`SELECT "id" FROM "ServiceSite" WHERE "id" = ${serviceSiteId} FOR SHARE`;
}

/** Resolve a customer's unit only when it is visible under the caller's branch rules. */
export async function assertUnitInScope(
    user: AuthUser,
    customerId: string,
    unitId: string | null | undefined,
    db: Prisma.TransactionClient = prisma,
) {
    if (!unitId) return null;
    await db.$queryRaw`SELECT "id" FROM "Unit" WHERE "id" = ${unitId} FOR SHARE`;

    const where: Prisma.UnitWhereInput = {
        id: unitId,
        organizationId: user.orgId,
        customerId,
        ...branchScopedUnitWhere(user),
    };
    let unit = await db.unit.findFirst({ where });
    if (!unit) throw new ValidationError('Choose a unit registered to this customer and service branch.');

    // A site can move while the first read is in flight. Lock it, then re-read
    // the unit scope so a stale branch assignment cannot be linked to new work.
    if (unit.serviceSiteId) {
        await lockServiceSiteForLink(db, unit.serviceSiteId);
        unit = await db.unit.findFirst({ where });
        if (!unit) throw new ValidationError('Choose a unit registered to this customer and service branch.');
    }
    return unit;
}

/**
 * Resolve a branch that the caller is allowed to write to.
 * Throws rather than returning null so callers cannot ignore the result.
 */
export async function assertBranchInScope(user: AuthUser, branchId: string, db: Prisma.TransactionClient = prisma) {
    if (isBranchScoped(user) && branchId !== user.branchId) {
        throw new ForbiddenError('You can only act on your own branch');
    }

    const branch = await db.branch.findFirst({
        where: { id: branchId, organizationId: user.orgId },
    });

    if (!branch) throw new NotFoundError('Branch not found');
    return branch;
}

/** Resolve a customer belonging to the caller's organization. */
export async function assertCustomerInScope(user: AuthUser, customerId: string, db: Prisma.TransactionClient = prisma) {
    const customer = await db.customer.findFirst({
        where: { id: customerId, organizationId: user.orgId },
    });

    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
}

/**
 * Resolve a technician the caller may assign: same organization always, and
 * same branch when the caller is branch-scoped.
 */
export async function assertTechnicianInScope(user: AuthUser, technicianId: string, db: Prisma.TransactionClient = prisma) {
    const technician = await db.technician.findFirst({
        where: { id: technicianId, branch: { organizationId: user.orgId } },
    });

    if (!technician) throw new NotFoundError('Technician not found');

    if (isBranchScoped(user) && technician.branchId !== user.branchId) {
        throw new ForbiddenError('Cannot assign a technician from another branch');
    }

    return technician;
}
