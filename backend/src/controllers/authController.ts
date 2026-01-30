import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../db/prisma';
import { AuthUser } from '../types';

/**
 * LOGIN SCHEMA (Zod)
 */
const loginSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export const login = async (req: Request, res: Response) => {
    try {
        const validation = loginSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({ error: validation.error.issues[0].message });
        }

        const { email, password } = validation.data;

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error("JWT_SECRET environment variable is not set!");
            return res.status(500).json({ error: "Server configuration error" });
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: { organization: true }
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const payload: AuthUser = {
            userId: user.id,
            orgId: user.organizationId,
            role: user.role,
            branchId: user.branchId
        };

        const token = jwt.sign(payload, jwtSecret, { expiresIn: '24h' });

        res.json({
            token,
            user: {
                email: user.email,
                orgId: user.organizationId,
                orgName: user.organization.name,
                role: user.role,
                branchId: user.branchId
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server login error" });
    }
};
