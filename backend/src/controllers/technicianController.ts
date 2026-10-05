import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';
import { Prisma } from '@prisma/client';
import { auditInTransaction } from '../lib/auditLog';
import { requireUser } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import { assertBranchInScope, branchScopedWhere, isBranchScoped } from '../lib/tenancy';
import { toPage } from '../lib/pagination';
import { TERMINAL_STATUSES } from '../lib/dispatch';

const createTechnicianSchema = z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(8).max(20).optional(),
    branchId: z.string().uuid(),
    specialty: z.string().trim().max(120).optional(),
});

const updateTechnicianSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().min(8).max(20).nullable().optional(),
    branchId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
    specialty: z.string().trim().max(120).nullable().optional(),
});

const listTechniciansSchema = z.object({
    includeInactive: z
        .enum(['true', 'false'])
        .optional()
        .transform((v) => v === 'true'),
});

export const getTechnicians = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { includeInactive } = listTechniciansSchema.parse(req.query);

    const where: Prisma.TechnicianWhereInput = { ...branchScopedWhere(user) };
    if (!includeInactive) where.isActive = true;

    const technicians = await prisma.technician.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { branch: true },
    });

    // Every list endpoint returns the same { data, pagination } envelope so
    // clients never have to special-case a response shape. Staff lists are
    // small and always wanted in full, so they aren't paged.
    res.json(toPage(technicians, technicians.length, 1, Math.max(technicians.length, 1)));
};

export const createTechnician = async (req: Request, res: Response) => {
    const user = requireUser(req);

    const validation = createTechnicianSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Validation Error', validation.error.issues);
    }

    const technician = await prisma.$transaction(async (tx) => {
      await assertBranchInScope(user, validation.data.branchId, tx);
      const result = await tx.technician.create({
        data: validation.data,
        include: { branch: true },
      });
      await auditInTransaction(tx, req, 'TECHNICIAN_CREATE', 'technician', result.id, result.branchId);
      return result;
    });
    res.status(201).json(technician);
};

export const updateTechnician = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    const validation = updateTechnicianSchema.safeParse(req.body);
    if (!validation.success) {
        throw new ValidationError('Validation Error', validation.error.issues);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Technician" WHERE "id" = ${id} FOR UPDATE`;
      const technician = await tx.technician.findFirst({ where: { id, ...branchScopedWhere(user) } });
      if (!technician) throw new NotFoundError('Technician not found');
      if (validation.data.branchId && validation.data.branchId !== technician.branchId) {
          await assertBranchInScope(user, validation.data.branchId, tx);
      }
      if (validation.data.isActive === false || (validation.data.branchId && validation.data.branchId !== technician.branchId)) {
          const count = await tx.booking.count({ where: { technicianId: id, status: { notIn: TERMINAL_STATUSES } } });
          if (count > 0) throw new ValidationError('Reassign or cancel this technician’s open work orders before deactivation or moving branches.');
      }
      const result = await tx.technician.update({
        where: { id },
        data: validation.data,
        include: { branch: true },
      });
      await auditInTransaction(tx, req, 'TECHNICIAN_UPDATE', 'technician', result.id, result.branchId);
      return result;
    });
    res.json(updated);
};

export const deleteTechnician = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { id } = req.params as { id: string };

    // Soft delete — bookings reference technicians, and history must survive.
    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Technician" WHERE "id" = ${id} FOR UPDATE`;
        const technician = await tx.technician.findFirst({ where: { id, ...branchScopedWhere(user) } });
        if (!technician) throw new NotFoundError('Technician not found');
        const count = await tx.booking.count({ where: { technicianId: id, status: { notIn: TERMINAL_STATUSES } } });
        if (count > 0) throw new ValidationError('Reassign or cancel this technician’s open work orders before deactivation.');
        await tx.technician.update({ where: { id }, data: { isActive: false } });
        await auditInTransaction(tx, req, 'TECHNICIAN_DEACTIVATE', 'technician', id, technician.branchId);
    });

    res.json({ message: 'Technician deactivated successfully' });
};

export const getBranches = async (req: Request, res: Response) => {
    const user = requireUser(req);

    const branches = await prisma.branch.findMany({
        where: {
            organizationId: user.orgId,
            ...(isBranchScoped(user) ? { id: user.branchId } : {}),
        },
        orderBy: { name: 'asc' },
    });

    res.json(toPage(branches, branches.length, 1, Math.max(branches.length, 1)));
};
