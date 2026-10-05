import { BookingStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../types';
import { ConflictError, ValidationError } from '../middleware/errorHandler';
import { assertTechnicianInScope } from './tenancy';

export const TERMINAL_STATUSES: BookingStatus[] = [BookingStatus.COMPLETED, BookingStatus.CANCELLED];
export function assertOpen(status: BookingStatus) {
    if (TERMINAL_STATUSES.includes(status)) throw new ValidationError(`A ${status} work order is final and cannot be edited.`);
}

/** Lock the technician row before reading appointments. Concurrent dispatches
 * and staff edits share this lock across every running API process. */
export async function assertTechnicianAssignable(tx: Prisma.TransactionClient, user: AuthUser, technicianId: string, branchId: string) {
    await tx.$queryRaw`SELECT "id" FROM "Technician" WHERE "id" = ${technicianId} FOR UPDATE`;
    const technician = await assertTechnicianInScope(user, technicianId, tx);
    if (!technician.isActive) throw new ValidationError('Choose an active technician.');
    if (technician.branchId !== branchId) throw new ValidationError('Technician must belong to this booking’s branch.');
    return technician;
}

export async function assertDispatchAvailable(tx: Prisma.TransactionClient, user: AuthUser, technicianId: string, branchId: string, scheduledAt: Date, durationMinutes: number, excludeId?: string) {
    await assertTechnicianAssignable(tx, user, technicianId, branchId);
    const end = new Date(scheduledAt.getTime() + durationMinutes * 60_000);
    const appointments = await tx.booking.findMany({
        where: { technicianId, id: excludeId ? { not: excludeId } : undefined, status: { notIn: TERMINAL_STATUSES },
            scheduledAt: { lt: end, gte: new Date(scheduledAt.getTime() - 480 * 60_000) } },
        select: { scheduledAt: true, durationMinutes: true },
    });
    if (appointments.some((appointment) => appointment.scheduledAt.getTime() + appointment.durationMinutes * 60_000 > scheduledAt.getTime())) {
        throw new ConflictError('This technician already has an overlapping appointment. Choose another time or technician.');
    }
}
