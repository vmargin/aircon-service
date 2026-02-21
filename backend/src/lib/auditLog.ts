import { Request } from 'express';
import prisma from '../db/prisma';

/**
 * Log an audit event for branch-scoped actions. Does not throw; failures are logged to console.
 */
export async function logAudit(
    req: Request,
    action: string,
    resourceType: string,
    resourceId: string,
    branchId?: string | null,
    details?: string
): Promise<void> {
    const user = req.user;
    if (!user?.userId) return;

    try {
        await prisma.auditLog.create({
            data: {
                userId: user.userId,
                action,
                resourceType,
                resourceId,
                branchId: branchId ?? undefined,
                details: details ?? undefined,
            },
        });
    } catch (err) {
        console.error('Audit log write failed:', err);
    }
}
