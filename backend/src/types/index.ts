import { UserRole } from '@prisma/client';

export interface AuthUser {
    userId: string;
    orgId: string;
    role: UserRole;
    branchId?: string | null;
}

declare module 'express-serve-static-core' {
    interface Request {
        user?: AuthUser;
    }
}
