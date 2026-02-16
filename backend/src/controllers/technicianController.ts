import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { UserRole } from '@prisma/client';

export const getTechnicians = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { includeInactive } = req.query;

    try {
        const baseWhere: any = { branch: { organizationId: user.orgId } };

        if (includeInactive !== 'true') {
            baseWhere.isActive = true;
        }

        const where =
            user.role === UserRole.BRANCH_LEADER && user.branchId
                ? { ...baseWhere, branchId: user.branchId }
                : baseWhere;

        const technicians = await prisma.technician.findMany({
            where,
            orderBy: { name: 'asc' },
            include: { branch: true }
        });
        res.json(technicians);
    } catch (error) {
        console.error("Get technicians error:", error);
        res.status(500).json({ error: "Failed to fetch technicians" });
    }
};

export const createTechnician = async (req: Request, res: Response) => {
    const { user } = req;
    const { name, phone, branchId } = req.body;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    if (!name || !branchId) {
        return res.status(400).json({ error: "Name and Branch are required" });
    }

    try {
        // Enforce branch access for Branch Leaders
        if (user.role === UserRole.BRANCH_LEADER && branchId !== user.branchId) {
            return res.status(403).json({ error: "Cannot create technician for another branch" });
        }

        const technician = await prisma.technician.create({
            data: {
                name,
                phone,
                branchId
            },
            include: { branch: true }
        });
        res.status(201).json(technician);
    } catch (error) {
        console.error("Create technician error:", error);
        res.status(500).json({ error: "Failed to create technician" });
    }
};

export const updateTechnician = async (req: Request, res: Response) => {
    const { user } = req;
    const id = req.params.id as string;
    const { name, phone, branchId, isActive } = req.body;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const tech = await prisma.technician.findUnique({
            where: { id },
            include: { branch: true }
        });

        if (!tech) return res.status(404).json({ error: "Technician not found" });

        // Enforce branch access
        if (user.role === UserRole.BRANCH_LEADER && tech.branchId !== user.branchId) {
            return res.status(403).json({ error: "Access denied" });
        }

        const updated = await prisma.technician.update({
            where: { id },
            data: {
                name,
                phone,
                branchId: branchId as string,
                isActive: isActive as boolean
            },
            include: { branch: true }
        });
        res.json(updated);
    } catch (error) {
        console.error("Update technician error:", error);
        res.status(500).json({ error: "Failed to update technician" });
    }
};

export const deleteTechnician = async (req: Request, res: Response) => {
    const { user } = req;
    const id = req.params.id as string;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const tech = await prisma.technician.findUnique({ where: { id } });
        if (!tech) return res.status(404).json({ error: "Technician not found" });

        // Enforce branch access
        if (user.role === UserRole.BRANCH_LEADER && tech.branchId !== user.branchId) {
            return res.status(403).json({ error: "Access denied" });
        }

        // Soft delete: set isActive to false
        await prisma.technician.update({
            where: { id },
            data: { isActive: false }
        });

        res.json({ message: "Technician deactivated successfully" });
    } catch (error) {
        console.error("Delete technician error:", error);
        res.status(500).json({ error: "Failed to deactivate technician" });
    }
};

export const getBranches = async (req: Request, res: Response) => {
    const { user } = req;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const where: { organizationId: string; id?: string } = { organizationId: user.orgId };
        if (user.role === UserRole.BRANCH_LEADER && user.branchId) {
            where.id = user.branchId;
        }
        const branches = await prisma.branch.findMany({
            where,
            orderBy: { name: 'asc' }
        });
        res.json(branches);
    } catch (error) {
        console.error("Get branches error:", error);
        res.status(500).json({ error: "Failed to fetch branches" });
    }
};
