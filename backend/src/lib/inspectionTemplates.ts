import { InspectionItemType, Prisma } from '@prisma/client';
import { ValidationError } from '../middleware/errorHandler';

export async function loadInspectionTemplate(
    tx: Prisma.TransactionClient,
    organizationId: string,
    serviceType: string,
    templateId?: string | null,
) {
    if (!templateId) return null;
    const template = await tx.inspectionTemplate.findFirst({
        where: { id: templateId, organizationId, isActive: true, serviceType },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!template) throw new ValidationError('Choose an active checklist template for this service type.');
    return template;
}

export function checklistSnapshot(template: NonNullable<Awaited<ReturnType<typeof loadInspectionTemplate>>>) {
    return template.items.map((item) => ({
        id: item.id,
        label: item.label,
        type: item.type,
        ...(item.unitLabel ? { unitLabel: item.unitLabel } : {}),
        ...(item.type === InspectionItemType.MEASUREMENT ? { reading: '' } : {}),
        outcome: 'PENDING',
        checked: false,
    })) as Prisma.InputJsonArray;
}
