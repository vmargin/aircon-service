import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { UserRole } from '@prisma/client';

export const getTechnicians = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const baseWhere = { branch: { organizationId: user.orgId } };
        const where =
            user.role === UserRole.BRANCH_LEADER && user.branchId
                ? { ...baseWhere, branchId: user.branchId }
                : baseWhere;

        const technicians = await prisma.technician.findMany({
            where,
            orderBy: { name: 'asc' }
        });
        res.json(technicians);
    } catch (error) {
        console.error("Get technicians error:", error);
        res.status(500).json({ error: "Failed to fetch technicians" });
    }
};

export const getBranches = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const branches = await prisma.branch.findMany({
            where: { organizationId: user.orgId },
            orderBy: { name: 'asc' }
        });
        res.json(branches);
    } catch (error) {
        console.error("Get branches error:", error);
        res.status(500).json({ error: "Failed to fetch branches" });
    }
};
