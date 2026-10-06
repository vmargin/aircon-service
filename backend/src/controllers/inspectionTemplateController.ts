import { Request, Response } from 'express';
import { InspectionItemType, Prisma, UserRole } from '@prisma/client';
import { z } from 'zod';
import prisma from '../db/prisma';
import { auditInTransaction } from '../lib/auditLog';
import { requireUser } from '../middleware/auth';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler';

const itemSchema = z.object({
    label: z.string().trim().min(1).max(250),
    type: z.nativeEnum(InspectionItemType).default(InspectionItemType.CHECK),
    unitLabel: z.string().trim().max(32).nullable().optional(),
}).superRefine((item, context) => {
    if (item.type === InspectionItemType.MEASUREMENT && !item.unitLabel?.trim()) {
        context.addIssue({ code: 'custom', message: 'Measurements need a unit label, such as °C or psi.', path: ['unitLabel'] });
    }
});
const templateFields = {
    name: z.string().trim().min(1).max(120),
    serviceType: z.string().trim().min(1).max(120),
    items: z.array(itemSchema).min(1).max(30),
};
const createSchema = z.object(templateFields);
const updateSchema = z.object({
    name: z.string().trim().min(1).max(120),
    serviceType: z.string().trim().min(1).max(120),
    items: z.array(itemSchema).min(1).max(30),
    isActive: z.boolean(),
}).partial().refine((value) => Object.keys(value).length > 0, 'Enter at least one checklist template change.');
const listSchema = z.object({ includeInactive: z.enum(['true', 'false']).optional() });
const TEMPLATE_INCLUDE = { items: { orderBy: { sortOrder: 'asc' as const } } } satisfies Prisma.InspectionTemplateInclude;

function requireAdmin(user: ReturnType<typeof requireUser>) {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenError('Only organization admins can manage shared inspection templates.');
}

function itemsForWrite(items: z.infer<typeof itemSchema>[]) {
    return items.map((item, sortOrder) => ({
        label: item.label,
        type: item.type,
        unitLabel: item.type === InspectionItemType.MEASUREMENT ? item.unitLabel?.trim() ?? null : null,
        sortOrder,
    }));
}

export const getInspectionTemplates = async (req: Request, res: Response) => {
    const user = requireUser(req);
    const filters = listSchema.parse(req.query);
    const templates = await prisma.inspectionTemplate.findMany({
        where: {
            organizationId: user.orgId,
            ...(filters.includeInactive === 'true' && user.role === UserRole.ADMIN ? {} : { isActive: true }),
        },
        include: TEMPLATE_INCLUDE,
        orderBy: [{ serviceType: 'asc' }, { name: 'asc' }],
    });
    res.json(templates);
};

export const createInspectionTemplate = async (req: Request, res: Response) => {
    const user = requireUser(req);
    requireAdmin(user);
    const data = createSchema.parse(req.body);
    const template = await prisma.$transaction(async (tx) => {
        const created = await tx.inspectionTemplate.create({
            data: {
                name: data.name,
                serviceType: data.serviceType,
                organizationId: user.orgId,
                createdByUserId: user.userId,
                items: { create: itemsForWrite(data.items) },
            },
            include: TEMPLATE_INCLUDE,
        });
        await auditInTransaction(tx, req, 'INSPECTION_TEMPLATE_CREATE', 'inspection_template', created.id, user.branchId, `Created ${created.name}`);
        return created;
    });
    res.status(201).json(template);
};

export const updateInspectionTemplate = async (req: Request, res: Response) => {
    const user = requireUser(req);
    requireAdmin(user);
    const data = updateSchema.parse(req.body);
    const template = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "InspectionTemplate" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const current = await tx.inspectionTemplate.findFirst({ where: { id: req.params.id, organizationId: user.orgId } });
        if (!current) throw new NotFoundError('Inspection template not found');
        if (data.items) {
            await tx.inspectionTemplateItem.deleteMany({ where: { templateId: current.id } });
            await tx.inspectionTemplateItem.createMany({ data: itemsForWrite(data.items).map((item) => ({ ...item, templateId: current.id })) });
        }
        const updated = await tx.inspectionTemplate.update({
            where: { id: current.id },
            data: {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.serviceType !== undefined ? { serviceType: data.serviceType } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            },
            include: TEMPLATE_INCLUDE,
        });
        await auditInTransaction(tx, req, 'INSPECTION_TEMPLATE_UPDATE', 'inspection_template', updated.id, user.branchId, `Updated ${updated.name}${data.isActive === false ? ' (archived)' : ''}`);
        return updated;
    });
    res.json(template);
};
