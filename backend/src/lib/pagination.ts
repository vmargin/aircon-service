import { z } from 'zod';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

/**
 * Query params shared by every list endpoint. Unbounded `findMany` calls were
 * returning the entire table (with four relations joined) on every dashboard
 * load, which does not survive real data volumes.
 */
export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export interface Page<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
}

export function parsePagination(query: unknown) {
    const { page, limit } = paginationSchema.parse(query);
    return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function toPage<T>(data: T[], total: number, page: number, limit: number): Page<T> {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
        data,
        pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
    };
}
