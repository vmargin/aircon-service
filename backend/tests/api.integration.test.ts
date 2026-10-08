import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { Server } from 'http';
import { AuthUser } from '../src/types';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

/** The launcher migrates a dedicated local test database. This suite never
 * loads .env, resets a database, or connects to a production host. */
integration('HTTP domain integration (isolated PostgreSQL)', () => {
    let db: PrismaClient;
    let appDb: PrismaClient;
    let server: Server;
    let origin: string;
    let admin: string;
    let leader: string;
    let otherLeader: string;
    let branchless: string;
    let orgId: string;
    let otherOrgId: string;
    let branchId: string;
    let otherBranchId: string;
    let customerId: string;
    let otherCustomerId: string;
    let unitId: string;
    let technicianId: string;
    let inactiveId: string;
    let foreignTechId: string;
    let mainBooking: string;
    let itemId: string;
    let invoiceId: string;
    const secret = 'isolated-test-secret-at-least-thirty-two-characters';
    const scheduledAt = '2030-02-01T01:00:00.000Z';
    let warnings: jest.SpyInstance;

    async function request(route: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', token = admin) {
        const response = await fetch(`${origin}/api/v1${route}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        return { status: response.status, data: await response.json() as any };
    }
    function bookingBody(overrides: object = {}) {
        return { customerId, branchId, unitId, technicianId, scheduledAt, durationMinutes: 120, serviceType: 'Routine Maintenance', ...overrides };
    }

    beforeAll(async () => {
        const url = new URL(process.env.TEST_DATABASE_URL!);
        if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/arctic_test') throw new Error('Integration tests require the dedicated local arctic_test database.');
        process.env.DATABASE_URL = url.toString();
        process.env.JWT_SECRET = secret;
        process.env.NODE_ENV = 'test';
        process.env.RATE_LIMIT_LOGIN_MAX = '100';
        warnings = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        db = new PrismaClient();
        const fixture = randomUUID();
        const org = await db.organization.create({ data: { name: `Integration ${fixture}` } });
        const otherOrg = await db.organization.create({ data: { name: `Other tenant ${fixture}` } });
        orgId = org.id;
        otherOrgId = otherOrg.id;
        const branch = await db.branch.create({ data: { name: 'Makati', organizationId: orgId } });
        const otherBranch = await db.branch.create({ data: { name: 'QC', organizationId: orgId } });
        branchId = branch.id;
        otherBranchId = otherBranch.id;
        const hashed = await bcrypt.hash('demo1234', 4);
        const users = await Promise.all([
            db.user.create({ data: { email: `admin-${fixture}@example.com`, password: hashed, role: 'ADMIN', organizationId: orgId } }),
            db.user.create({ data: { email: `leader-${fixture}@example.com`, password: hashed, role: 'BRANCH_LEADER', organizationId: orgId, branchId } }),
            db.user.create({ data: { email: `other-leader-${fixture}@example.com`, password: hashed, role: 'BRANCH_LEADER', organizationId: orgId, branchId: otherBranchId } }),
            db.user.create({ data: { email: `branchless-${fixture}@example.com`, password: hashed, role: 'BRANCH_LEADER', organizationId: orgId } }),
        ]);
        const sign = (user: typeof users[number]) => jwt.sign({ userId: user.id, orgId: user.organizationId, role: user.role, branchId: user.branchId } satisfies AuthUser, secret);
        admin = sign(users[0]); leader = sign(users[1]); otherLeader = sign(users[2]); branchless = sign(users[3]);
        const customer = await db.customer.create({ data: { name: 'Test Client', phone: '09170000001', organizationId: orgId } });
        const other = await db.customer.create({ data: { name: 'Other Client', phone: '09170000002', organizationId: orgId } });
        customerId = customer.id; otherCustomerId = other.id;
        const unit = await db.unit.create({ data: { name: 'Living room', brand: 'Daikin', customerId, organizationId: orgId } });
        unitId = unit.id;
        const techs = await Promise.all([
            db.technician.create({ data: { name: 'Active', branchId } }),
            db.technician.create({ data: { name: 'Inactive', branchId, isActive: false } }),
            db.technician.create({ data: { name: 'Other Branch', branchId: otherBranchId } }),
        ]);
        [technicianId, inactiveId, foreignTechId] = techs.map((tech) => tech.id);
        await db.customer.create({ data: { name: 'Foreign tenant client', phone: '09170000003', organizationId: otherOrgId } });
        const { createApp } = await import('../src/app');
        appDb = (await import('../src/db/prisma')).default;
        server = createApp().listen(0, '127.0.0.1');
        await new Promise<void>((resolve) => server.once('listening', resolve));
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Test server did not start');
        origin = `http://127.0.0.1:${address.port}`;
    }, 30_000);

    afterAll(async () => {
        if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        if (db && orgId) {
            const scope = { branch: { organizationId: orgId } };
            // Only this suite’s UUID-named fixtures are removed; no truncation.
            await db.payment.deleteMany({ where: { invoice: { booking: scope } } });
            await db.stockMovement.deleteMany({ where: { inventoryItem: scope } });
            await db.partUsage.deleteMany({ where: { booking: scope } });
            await db.invoiceLine.deleteMany({ where: { invoice: { booking: scope } } });
            await db.estimateLineItem.deleteMany({ where: { revision: { estimate: { serviceRequest: { organizationId: orgId } } } } });
            await db.invoice.deleteMany({ where: { booking: scope } });
            await db.booking.deleteMany({ where: scope });
            await db.estimateRevision.deleteMany({ where: { estimate: { serviceRequest: { organizationId: orgId } } } });
            await db.estimate.deleteMany({ where: { serviceRequest: { organizationId: orgId } } });
            await db.serviceRequest.deleteMany({ where: { organizationId: orgId } });
            await db.inspectionTemplateItem.deleteMany({ where: { template: { organizationId: orgId } } });
            await db.inspectionTemplate.deleteMany({ where: { organizationId: orgId } });
            await db.inventoryItem.deleteMany({ where: scope });
            await db.unit.deleteMany({ where: { organizationId: orgId } });
            await db.serviceSite.deleteMany({ where: { organizationId: orgId } });
            await db.technician.deleteMany({ where: scope });
            await db.auditLog.deleteMany({ where: { user: { organizationId: orgId } } });
            await db.user.deleteMany({ where: { organizationId: orgId } });
            await db.customer.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } });
            await db.branch.deleteMany({ where: { organizationId: orgId } });
            await db.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
        }
        await db?.$disconnect();
        await appDb?.$disconnect();
        warnings?.mockRestore();
    }, 30_000);

    it('validates live permissions, tenant visibility, and missing branch configuration', async () => {
        expect((await request('/bookings', undefined, 'GET', 'invalid')).status).toBe(401);
        expect((await request('/bookings', undefined, 'GET', branchless)).status).toBe(403);
        const clients = await request('/customers');
        expect(clients.data.data.map((client: any) => client.organizationId)).toEqual([orgId, orgId]);
        const forged = jwt.sign({ userId: jwt.decode(leader) && (jwt.decode(leader) as any).userId, orgId, role: 'ADMIN', branchId }, secret);
        expect((await request('/branches', undefined, 'GET', forged)).status).toBe(401);
        expect((await request('/bookings', bookingBody({ branchId: otherBranchId, technicianId: foreignTechId }), 'POST', leader)).status).toBe(403);
        const invalidJson = await fetch(`${origin}/api/v1/bookings`, { method: 'POST', headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' }, body: '{"bad"' });
        expect(invalidJson.status).toBe(400);
    });

    it('rejects inactive, cross-branch, and mismatched customer/unit assignments', async () => {
        expect((await request('/bookings', bookingBody({ technicianId: inactiveId }))).status).toBe(400);
        expect((await request('/bookings', bookingBody({ technicianId: foreignTechId }))).status).toBe(400);
        expect((await request('/bookings', bookingBody({ customerId: otherCustomerId }))).status).toBe(400);
    });

    it('serializes simultaneous dispatches and allows appointments that only touch endpoints', async () => {
        const results = await Promise.all([request('/bookings', bookingBody()), request('/bookings', bookingBody())]);
        expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
        mainBooking = results.find((result) => result.status === 201)!.data.id;
        expect((await request('/bookings', bookingBody({ scheduledAt: '2030-02-01T03:00:00.000Z' }))).status).toBe(201);
        expect((await request(`/technicians/${technicianId}`, { isActive: false }, 'PATCH')).status).toBe(400);
    });

    it('enforces ordered status transitions and persists the field-service checklist', async () => {
        expect((await request(`/bookings/${mainBooking}`, { status: 'ON_SITE' }, 'PATCH')).status).toBe(400);
        expect((await request(`/bookings/${mainBooking}`, { status: 'CONFIRMED' }, 'PATCH')).status).toBe(200);
        expect((await request(`/bookings/${mainBooking}`, { status: 'ON_SITE' }, 'PATCH')).status).toBe(200);
        const outcomes = [
            { id: 'visual', label: 'Inspect indoor and outdoor units', outcome: 'PENDING' },
            { id: 'filter', label: 'Inspect air filter', outcome: 'PASS' },
            { id: 'coil', label: 'Inspect coils', outcome: 'FOLLOW_UP' },
            { id: 'refrigerant', label: 'Check refrigerant observations', outcome: 'NOT_APPLICABLE' },
        ];
        const update = await request(`/bookings/${mainBooking}`, {
            diagnosis: 'Filter requires replacement',
            checklist: outcomes,
        }, 'PATCH');
        expect(update.data.durationMinutes).toBe(120);
        expect(update.status).toBe(200);
        expect(update.data.checklist.map((item: any) => item.outcome)).toEqual([
            'PENDING', 'PASS', 'FOLLOW_UP', 'NOT_APPLICABLE',
        ]);
        expect(update.data.checklist.map((item: any) => item.checked)).toEqual([false, true, false, false]);
        expect((await request(`/bookings/${mainBooking}`, {
            checklist: [{ id: 'invalid', label: 'Invalid status', outcome: 'FAILED' }],
        }, 'PATCH')).status).toBe(400);
        expect((await request(`/bookings/${mainBooking}`, {
            checklist: [{ id: 'missing-outcome', label: 'No result' }],
        }, 'PATCH')).status).toBe(400);
        expect((await request(`/bookings/${mainBooking}`, {
            checklist: [{ id: 'conflict', label: 'Conflicting fields', outcome: 'PASS', checked: false }],
        }, 'PATCH')).status).toBe(400);
        expect((await request(`/bookings/${mainBooking}`, {
            checklist: [{ id: 'duplicate', label: 'First', outcome: 'PASS' }, { id: 'duplicate', label: 'Second', outcome: 'PENDING' }],
        }, 'PATCH')).status).toBe(400);
        expect((await request(`/bookings/${mainBooking}`, {
            checklist: [{ id: '', label: 'Missing ID', outcome: 'PASS' }],
        }, 'PATCH')).status).toBe(400);
        expect((await request(`/bookings/${mainBooking}`, {
            checklist: [{ id: 'empty-label', label: '  ', outcome: 'PASS' }],
        }, 'PATCH')).status).toBe(400);
        const legacyChecklist = [
            { id: 'legacy-passed', label: 'Legacy passed result', checked: true },
            { id: 'legacy-pending', label: 'Legacy unchecked result', checked: false },
        ];
        const legacy = await request(`/bookings/${mainBooking}`, {
            checklist: legacyChecklist,
        }, 'PATCH');
        expect(legacy.status).toBe(200);
        expect(legacy.data.checklist).toEqual(legacyChecklist);
        const legacyRead = await request(`/bookings/${mainBooking}`, undefined, 'GET');
        expect(legacyRead.data.checklist).toEqual(legacyChecklist);
        expect((await request(`/units/${unitId}`, { customerId: otherCustomerId }, 'PATCH')).status).toBe(400);
    });

    it('atomically consumes stock with movements and prevents negative inventory', async () => {
        const create = await request('/inventory', { branchId, name: 'Air filter', sku: 'TEST-FILTER', quantityOnHand: 5, reorderLevel: 2, unitCost: 12.25 });
        expect(create.status).toBe(201);
        itemId = create.data.id;
        const openingMovement = await db.stockMovement.findFirstOrThrow({ where: { inventoryItemId: itemId, reason: 'Opening stock' } });
        expect(openingMovement).toMatchObject({ quantity: 5, idempotencyKey: null, idempotencyPayloadHash: null });

        const missingPartKey = await request(`/bookings/${mainBooking}/parts`, { inventoryItemId: itemId, quantity: 1 });
        const missingRestockKey = await request(`/inventory/${itemId}/restock`, { quantity: 1 }, 'PATCH');
        const missingAdjustmentKey = await request(`/inventory/${itemId}/adjustments`, { delta: 1, reason: 'Missing retry key' }, 'POST');
        expect([missingPartKey.status, missingRestockKey.status, missingAdjustmentKey.status]).toEqual([400, 400, 400]);
        expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantityOnHand).toBe(5);
        expect(await db.partUsage.count({ where: { bookingId: mainBooking, inventoryItemId: itemId } })).toBe(0);
        expect(await db.stockMovement.count({ where: { inventoryItemId: itemId } })).toBe(1);

        const use = () => request(`/bookings/${mainBooking}/parts`, { inventoryItemId: itemId, quantity: 4, idempotencyKey: randomUUID() });
        expect((await Promise.all([use(), use()])).map((result) => result.status).sort()).toEqual([201, 409]);
        expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantityOnHand).toBe(1);

        const partKey = randomUUID();
        const partRequest = { inventoryItemId: itemId, quantity: 1, idempotencyKey: partKey };
        const partRetries = await Promise.all([
            request(`/bookings/${mainBooking}/parts`, partRequest),
            request(`/bookings/${mainBooking}/parts`, partRequest),
        ]);
        expect(partRetries.map((result) => result.status).sort()).toEqual([200, 201]);
        expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantityOnHand).toBe(0);
        expect(await db.stockMovement.count({ where: { idempotencyKey: partKey } })).toBe(1);
        expect(await db.partUsage.count({ where: { bookingId: mainBooking, inventoryItemId: itemId } })).toBe(2);
        expect((await request(`/bookings/${mainBooking}/parts`, partRequest)).status).toBe(200);
        expect((await request(`/bookings/${mainBooking}/parts`, { ...partRequest, quantity: 2 })).status).toBe(409);
        expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantityOnHand).toBe(0);

        expect((await request(`/inventory/${itemId}/restock`, { quantity: -2, idempotencyKey: randomUUID() }, 'PATCH')).status).toBe(400);
        const restockKey = randomUUID();
        const restockRequest = { quantity: 2, note: 'Supplier delivery', idempotencyKey: restockKey };
        const restockRetries = await Promise.all([
            request(`/inventory/${itemId}/restock`, restockRequest, 'PATCH'),
            request(`/inventory/${itemId}/restock`, restockRequest, 'PATCH'),
        ]);
        expect(restockRetries.map((result) => result.status)).toEqual([200, 200]);
        expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantityOnHand).toBe(2);
        expect(await db.stockMovement.count({ where: { idempotencyKey: restockKey } })).toBe(1);
        expect((await request(`/inventory/${itemId}/restock`, restockRequest, 'PATCH')).status).toBe(200);
        expect((await request(`/inventory/${itemId}/restock`, { ...restockRequest, quantity: 3 }, 'PATCH')).status).toBe(409);
        expect((await request(`/inventory/${itemId}/adjustments`, {
            delta: 2, reason: 'Same effect, different action', idempotencyKey: restockKey,
        }, 'POST')).status).toBe(409);
        expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantityOnHand).toBe(2);

        const adjustmentKey = randomUUID();
        const adjustmentRequest = { delta: 3, reason: 'Cycle count correction', idempotencyKey: adjustmentKey };
        const adjustmentRetries = await Promise.all([
            request(`/inventory/${itemId}/adjustments`, adjustmentRequest, 'POST'),
            request(`/inventory/${itemId}/adjustments`, adjustmentRequest, 'POST'),
        ]);
        expect(adjustmentRetries.map((result) => result.status).sort()).toEqual([200, 201]);
        expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantityOnHand).toBe(5);
        expect(await db.stockMovement.count({ where: { idempotencyKey: adjustmentKey } })).toBe(1);
        expect((await request(`/inventory/${itemId}/adjustments`, adjustmentRequest, 'POST')).status).toBe(200);
        expect((await request(`/inventory/${itemId}/adjustments`, {
            ...adjustmentRequest, delta: -2,
        }, 'POST')).status).toBe(409);
        expect((await request(`/inventory/${itemId}/adjustments`, adjustmentRequest, 'POST', leader)).status).toBe(409);
        expect((await request(`/inventory/${itemId}/adjustments`, {
            delta: -6, reason: 'Remove more than available', idempotencyKey: randomUUID(),
        }, 'POST')).status).toBe(409);
        expect((await request(`/inventory/${itemId}/adjustments`, {
            delta: 0, reason: 'No change', idempotencyKey: randomUUID(),
        }, 'POST')).status).toBe(400);
        expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantityOnHand).toBe(5);

        const maximum = await request('/inventory', {
            branchId, name: 'Maximum stock item', sku: 'TEST-MAX-STOCK', quantityOnHand: 1_000_000,
            reorderLevel: 0, unitCost: 1,
        });
        expect(maximum.status).toBe(201);
        expect((await request(`/inventory/${maximum.data.id}/adjustments`, {
            delta: 1, reason: 'Over supported limit', idempotencyKey: randomUUID(),
        }, 'POST')).status).toBe(400);

        const foreign = await request('/inventory', {
            branchId: otherBranchId, name: 'Other branch stock', sku: 'TEST-OTHER-BRANCH',
            quantityOnHand: 2, reorderLevel: 1, unitCost: 5,
        });
        expect(foreign.status).toBe(201);
        expect((await request(`/inventory/${foreign.data.id}/adjustments`, {
            delta: -1, reason: 'Branch leader must not cross branches', idempotencyKey: randomUUID(),
        }, 'POST', leader)).status).toBe(404);
        expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: foreign.data.id } })).quantityOnHand).toBe(2);

        const movements = await db.stockMovement.findMany({ where: { inventoryItemId: itemId } });
        expect(movements.map((movement) => movement.quantity).sort((a, b) => a - b)).toEqual([-4, -1, 2, 3, 5]);
        const adjustmentMovement = await db.stockMovement.findUniqueOrThrow({ where: { idempotencyKey: adjustmentKey } });
        expect(adjustmentMovement).toMatchObject({ quantity: 3, reason: 'Cycle count correction', bookingId: null });
        expect(await db.auditLog.count({ where: { action: 'PART_USE', resourceId: mainBooking } })).toBe(2);
        expect(await db.auditLog.count({ where: { action: 'INVENTORY_RESTOCK', resourceId: itemId } })).toBe(1);
        const adjustmentAudit = await db.auditLog.findFirstOrThrow({ where: { action: 'INVENTORY_ADJUST', resourceId: itemId } });
        expect(adjustmentAudit).toMatchObject({ branchId, details: expect.stringContaining('+3 pcs') });
        expect(adjustmentAudit.details).toContain('Cycle count correction');
    });

    it('issues one invoice per job and derives exact partial receipts with idempotency', async () => {
        expect((await request(`/bookings/${mainBooking}`, { status: 'COMPLETED' }, 'PATCH')).status).toBe(200);
        const completedBeforeBilling = await request(`/bookings/${mainBooking}`, undefined, 'GET');
        expect(completedBeforeBilling.data).toMatchObject({ status: 'COMPLETED', invoice: null });
        expect((await request(`/bookings/${mainBooking}`, undefined, 'DELETE')).status).toBe(400);
        const created = await request('/invoices', { bookingId: mainBooking, amount: 100.10 });
        expect(created.status).toBe(201);
        invoiceId = created.data.id;
        expect(created.data.amount).toBe('100.10');
        expect((await request('/invoices', { bookingId: mainBooking, amount: 100 })).status).toBe(409);
        expect((await request(`/bookings/${mainBooking}/parts`, { inventoryItemId: itemId, quantity: 1, idempotencyKey: randomUUID() })).status).toBe(400);
        const payment = { amount: 33.35, method: 'CASH', idempotencyKey: randomUUID() };
        const first = await request(`/invoices/${invoiceId}/payments`, payment);
        expect(first).toMatchObject({ status: 201, data: { amountPaid: '33.35', balance: '66.75', paymentStatus: 'PARTIAL' } });
        expect((await request(`/invoices/${invoiceId}/payments`, payment)).status).toBe(200);
        expect((await request(`/invoices/${invoiceId}/payments`, { ...payment, amount: 10 })).status).toBe(409);
        expect((await request(`/invoices/${invoiceId}/payment`, { paymentStatus: 'PAID' }, 'PATCH')).status).toBe(400);
    });

    it('serializes concurrent collections, rejects overpayment, and preserves final records', async () => {
        const pay = () => request(`/invoices/${invoiceId}/payments`, { amount: 60, method: 'BANK', idempotencyKey: randomUUID() });
        expect((await Promise.all([pay(), pay()])).map((result) => result.status).sort()).toEqual([201, 400]);
        const settled = await request(`/invoices/${invoiceId}/payments`, { amount: 6.75, method: 'E_WALLET', idempotencyKey: randomUUID() });
        expect(settled.data).toMatchObject({ amountPaid: '100.10', balance: '0.00', paymentStatus: 'PAID' });
        expect((await request(`/invoices/${invoiceId}/payments`, { amount: 1, method: 'CASH', idempotencyKey: randomUUID() })).status).toBe(400);
        expect((await request(`/bookings/${mainBooking}`, { status: 'COMPLETED', technicianId: foreignTechId }, 'PATCH')).status).toBe(400);
        expect((await request(`/bookings/${mainBooking}`, { status: 'COMPLETED' }, 'PATCH')).status).toBe(200);
        expect((await request(`/bookings/${mainBooking}`, { diagnosis: 'Changed history' }, 'PATCH')).status).toBe(400);
        expect((await request(`/bookings/${mainBooking}`, { status: 'COMPLETED' }, 'PATCH')).status).toBe(200);
        expect((await request(`/bookings/${mainBooking}`, undefined, 'DELETE')).status).toBe(400);
        expect(await db.payment.count({ where: { invoiceId } })).toBe(3);
        expect(await db.auditLog.count({ where: { resourceId: invoiceId, action: 'PAYMENT_RECORD' } })).toBe(3);
    });

    it('retains legacy paid and unknown partial balances without fabricating receipts', async () => {
        const partialJob = await request('/bookings', bookingBody({ technicianId: null, scheduledAt: '2030-02-03T01:00:00.000Z' }));
        const paidJob = await request('/bookings', bookingBody({ technicianId: null, scheduledAt: '2030-02-04T01:00:00.000Z' }));
        const partial = await db.invoice.create({ data: { bookingId: partialJob.data.id, amount: new Prisma.Decimal(500), paymentStatus: 'PARTIAL' } });
        const paid = await db.invoice.create({ data: { bookingId: paidJob.data.id, amount: new Prisma.Decimal(200), paymentStatus: 'PAID' } });
        const invoices = (await request('/invoices')).data.data;
        expect(invoices.find((invoice: any) => invoice.id === partial.id)).toMatchObject({ amountPaid: null, balance: null, needsReview: true });
        expect(invoices.find((invoice: any) => invoice.id === paid.id)).toMatchObject({ amountPaid: '200.00', balance: '0.00', legacyBaseline: true });
        expect((await request(`/invoices/${partial.id}/payments`, { amount: 1, method: 'CASH', idempotencyKey: randomUUID() })).status).toBe(409);
        expect(await db.payment.count({ where: { invoiceId: { in: [partial.id, paid.id] } } })).toBe(0);
    });

    it('returns scoped aggregate reporting independent of page size', async () => {
        const overview = await request('/overview');
        expect(overview.status).toBe(200);
        expect(overview.data.summary).toMatchObject({ totalJobs: 4, collected: '300.10', outstanding: '0.00', needsReviewInvoices: 1 });
        expect(overview.data.monthlyService).toHaveLength(6);
        // The undated legacy settlement remains in lifetime totals, but its
        // collection month cannot be inferred from the invoice issue date.
        expect(overview.data.monthlyService.reduce((sum: number, month: any) => sum + month.collected, 0)).toBe(100.10);
        const list = await request('/bookings?limit=1');
        expect(list.data.pagination.total).toBe(4);
        expect(list.data.data).toHaveLength(1);
        expect((await request('/activity')).data.data.some((entry: any) => entry.action === 'PART_USE')).toBe(true);
        expect((await request('/bookings?limit=-1')).status).toBe(400);
    });

    it('scopes unit reads, edits, and maintenance reminders to attributable branch assets', async () => {
        const dueAt = new Date(Date.now() + 2 * 24 * 60 * 60_000);
        const [localSite, foreignSite] = await Promise.all([
            db.serviceSite.create({ data: { name: 'Local site', address: 'Makati', customerId, organizationId: orgId, branchId } }),
            db.serviceSite.create({ data: { name: 'Foreign site', address: 'Quezon City', customerId, organizationId: orgId, branchId: otherBranchId } }),
        ]);
        const [localUnit, foreignUnit, historyUnit, unattributedUnit, ambiguousUnit] = await Promise.all([
            db.unit.create({ data: { name: 'Local site unit', brand: 'Daikin', customerId, organizationId: orgId, serviceSiteId: localSite.id, nextMaintenanceAt: dueAt } }),
            db.unit.create({ data: { name: 'Foreign site unit', brand: 'Carrier', customerId, organizationId: orgId, serviceSiteId: foreignSite.id, nextMaintenanceAt: dueAt } }),
            db.unit.create({ data: { name: 'Legacy local unit', brand: 'Mitsubishi', customerId, organizationId: orgId, nextMaintenanceAt: dueAt } }),
            db.unit.create({ data: { name: 'Unattributed unit', brand: 'LG', customerId, organizationId: orgId, nextMaintenanceAt: dueAt } }),
            db.unit.create({ data: { name: 'Shared history unit', brand: 'Panasonic', customerId, organizationId: orgId, nextMaintenanceAt: dueAt } }),
        ]);
        const createUnitHistory = (unitId: string, historyBranchId: string) => db.booking.create({
            data: {
                unitId,
                branchId: historyBranchId,
                customerId,
                serviceType: 'Historical maintenance',
                scheduledAt: dueAt,
            },
        });
        await Promise.all([
            createUnitHistory(historyUnit.id, branchId),
            createUnitHistory(ambiguousUnit.id, branchId),
            createUnitHistory(ambiguousUnit.id, otherBranchId),
        ]);

        const localList = await request(`/units?customerId=${customerId}`, undefined, 'GET', leader);
        const localIds = localList.data.data.map((unit: any) => unit.id);
        expect(localList.status).toBe(200);
        expect(localIds).toContain(localUnit.id);
        expect(localIds).toContain(historyUnit.id);
        expect(localIds).not.toContain(foreignUnit.id);
        expect(localIds).not.toContain(unattributedUnit.id);
        expect(localIds).not.toContain(ambiguousUnit.id);
        expect(localList.data.pagination.total).toBe(localList.data.data.length);
        expect(localList.data.data.find((unit: any) => unit.id === historyUnit.id)._count.bookings).toBe(1);

        const foreignList = await request(`/units?customerId=${customerId}`, undefined, 'GET', otherLeader);
        expect(foreignList.data.data.map((unit: any) => unit.id)).toContain(foreignUnit.id);
        expect(foreignList.data.data.map((unit: any) => unit.id)).not.toContain(historyUnit.id);
        const adminList = await request(`/units?customerId=${customerId}`);
        expect(adminList.data.data.map((unit: any) => unit.id)).toEqual(expect.arrayContaining([
            localUnit.id, foreignUnit.id, historyUnit.id, unattributedUnit.id, ambiguousUnit.id,
        ]));

        const deniedDetach = await request(`/units/${foreignUnit.id}`, { name: 'Tampered unit', serviceSiteId: null }, 'PATCH', leader);
        expect(deniedDetach.status).toBe(404);
        await expect(db.unit.findUniqueOrThrow({ where: { id: foreignUnit.id } })).resolves.toMatchObject({
            name: 'Foreign site unit', serviceSiteId: foreignSite.id,
        });
        expect((await request(`/units/${historyUnit.id}`, { notes: 'Updated without attribution', serviceSiteId: null }, 'PATCH', leader)).status).toBe(400);
        const attributedUpdate = await request(`/units/${historyUnit.id}`, { notes: 'Branch verified', serviceSiteId: localSite.id }, 'PATCH', leader);
        expect(attributedUpdate.status).toBe(200);
        expect(attributedUpdate.data).toMatchObject({ notes: 'Branch verified', serviceSiteId: localSite.id });

        const missingSiteCreate = await request('/units', {
            customerId, name: 'Missing site unit', brand: 'Test',
        }, 'POST', leader);
        expect(missingSiteCreate.status).toBe(400);
        const foreignSiteCreate = await request('/units', {
            customerId, name: 'Wrong site unit', brand: 'Test', serviceSiteId: foreignSite.id,
        }, 'POST', leader);
        expect(foreignSiteCreate.status).toBe(400);

        const dueDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(dueAt);
        const localMaintenance = await request(`/reports/maintenance-due?from=${dueDate}&to=${dueDate}`, undefined, 'GET', leader);
        const localMaintenanceIds = localMaintenance.data.data.map((unit: any) => unit.id);
        expect(localMaintenance.status).toBe(200);
        expect(localMaintenanceIds).toEqual(expect.arrayContaining([localUnit.id, historyUnit.id]));
        expect(localMaintenanceIds).not.toContain(foreignUnit.id);
        expect(localMaintenanceIds).not.toContain(unattributedUnit.id);
        expect(localMaintenanceIds).not.toContain(ambiguousUnit.id);
        expect((await request(`/reports/maintenance-due?from=${dueDate}&to=${dueDate}&branchId=${otherBranchId}`, undefined, 'GET', leader)).status).toBe(403);

        const invalidForeignBooking = await request('/bookings', bookingBody({
            unitId: foreignUnit.id,
            scheduledAt: '2030-03-01T01:00:00.000Z',
        }), 'POST', leader);
        const invalidAmbiguousBooking = await request('/bookings', bookingBody({
            unitId: ambiguousUnit.id,
            scheduledAt: '2030-03-01T04:00:00.000Z',
        }), 'POST', leader);
        expect(invalidForeignBooking.status).toBe(400);
        expect(invalidAmbiguousBooking.status).toBe(400);

        const validBranchBooking = await request('/bookings', bookingBody({
            unitId: historyUnit.id,
            scheduledAt: '2030-03-01T01:00:00.000Z',
        }), 'POST', leader);
        expect(validBranchBooking.status).toBe(201);
        const rejectedUnitChange = await request(`/bookings/${validBranchBooking.data.id}`, { unitId: ambiguousUnit.id }, 'PATCH', leader);
        expect(rejectedUnitChange.status).toBe(400);
        await expect(db.booking.findUniqueOrThrow({ where: { id: validBranchBooking.data.id } })).resolves.toMatchObject({ unitId: historyUnit.id });

        const alternateSite = await db.serviceSite.create({
            data: { name: 'Second local site', address: 'Makati Avenue', accessNotes: 'Use the side entrance', customerId, organizationId: orgId, branchId },
        });
        const alternateUnit = await db.unit.create({
            data: { name: 'Second local unit', brand: 'Daikin', customerId, organizationId: orgId, serviceSiteId: alternateSite.id },
        });
        const acceptedUnitChange = await request(`/bookings/${validBranchBooking.data.id}`, { unitId: alternateUnit.id }, 'PATCH', leader);
        expect(acceptedUnitChange.status).toBe(200);
        expect(acceptedUnitChange.data).toMatchObject({
            unitId: alternateUnit.id,
            serviceSiteId: alternateSite.id,
            serviceAddress: alternateSite.address,
            accessNotes: alternateSite.accessNotes,
        });

        const requestBody = {
            branchId, customerId, unitId: historyUnit.id,
            serviceType: 'Diagnostic', reportedIssue: 'Unit needs a branch-scoped assessment',
        };
        const validBranchRequest = await request('/service-requests', requestBody, 'POST', leader);
        expect(validBranchRequest.status).toBe(201);
        expect((await request('/service-requests', { ...requestBody, unitId: foreignUnit.id }, 'POST', leader)).status).toBe(400);
        expect((await request('/service-requests', { ...requestBody, unitId: ambiguousUnit.id }, 'POST', leader)).status).toBe(400);
        expect((await request(`/service-requests/${validBranchRequest.data.id}`, { unitId: ambiguousUnit.id }, 'PATCH', leader)).status).toBe(400);

        expect((await request(`/units/${historyUnit.id}`, { serviceSiteId: foreignSite.id }, 'PATCH')).status).toBe(409);
        expect((await request(`/units/${ambiguousUnit.id}`, { serviceSiteId: localSite.id }, 'PATCH')).status).toBe(409);

        const localDue = (await request('/overview', undefined, 'GET', leader)).data.dueUnits.map((unit: any) => unit.id);
        const foreignDue = (await request('/overview', undefined, 'GET', otherLeader)).data.dueUnits.map((unit: any) => unit.id);
        const adminDue = (await request('/overview')).data.dueUnits.map((unit: any) => unit.id);
        expect(localDue).toEqual(expect.arrayContaining([localUnit.id, historyUnit.id]));
        expect(localDue).not.toContain(foreignUnit.id);
        expect(localDue).not.toContain(unattributedUnit.id);
        expect(localDue).not.toContain(ambiguousUnit.id);
        expect(foreignDue).toContain(foreignUnit.id);
        expect(foreignDue).not.toContain(historyUnit.id);
        expect(adminDue).toEqual(expect.arrayContaining([
            localUnit.id, foreignUnit.id, historyUnit.id, unattributedUnit.id, ambiguousUnit.id,
        ]));
    });

    it('filters the attention queue using the dashboard rule within branch scope', async () => {
        const marker = randomUUID();
        const createAttentionBooking = (data: {
            branchId: string;
            priority: 'NORMAL' | 'HIGH' | 'URGENT';
            status: 'PENDING' | 'CONFIRMED' | 'COMPLETED';
            scheduledAt: Date;
            checklist?: Prisma.InputJsonValue;
        }) => db.booking.create({
            data: {
                ...data,
                serviceType: 'Attention ' + marker,
                customerId,
                technicianId: null,
            },
        });
        const past = new Date(Date.now() - 24 * 60 * 60_000);
        const future = new Date(Date.now() + 24 * 60 * 60_000);
        const [highPriority, overdue, normalFuture, billedCompleted, otherBranchHigh, incomplete, followUp, unbilled] = await Promise.all([
            createAttentionBooking({ branchId, priority: 'URGENT', status: 'CONFIRMED', scheduledAt: future }),
            createAttentionBooking({ branchId, priority: 'NORMAL', status: 'PENDING', scheduledAt: past }),
            createAttentionBooking({ branchId, priority: 'NORMAL', status: 'PENDING', scheduledAt: future }),
            createAttentionBooking({ branchId, priority: 'HIGH', status: 'COMPLETED', scheduledAt: past }),
            createAttentionBooking({ branchId: otherBranchId, priority: 'HIGH', status: 'CONFIRMED', scheduledAt: future }),
            createAttentionBooking({ branchId, priority: 'NORMAL', status: 'CONFIRMED', scheduledAt: future, checklist: [{ id: 'pending', label: 'Drain check', outcome: 'PENDING', checked: false }] }),
            createAttentionBooking({ branchId, priority: 'NORMAL', status: 'COMPLETED', scheduledAt: past, checklist: [{ id: 'follow-up', label: 'Leak observation', outcome: 'FOLLOW_UP', checked: false }] }),
            createAttentionBooking({ branchId, priority: 'NORMAL', status: 'COMPLETED', scheduledAt: future }),
        ]);
        await Promise.all([billedCompleted, followUp].map((booking) => db.invoice.create({
            data: { bookingId: booking.id, amount: new Prisma.Decimal('100.00'), paymentStatus: 'UNPAID' },
        })));
        const adminQueue = await request('/bookings?attention=1&q=' + marker);
        const branchQueue = await request('/bookings?attention=1&q=' + marker, undefined, 'GET', leader);
        const adminIds = adminQueue.data.data.map((booking: any) => booking.id);
        const branchIds = branchQueue.data.data.map((booking: any) => booking.id);

        expect(adminQueue.status).toBe(200);
        expect(adminIds.sort()).toEqual(
            [highPriority.id, overdue.id, otherBranchHigh.id, incomplete.id, followUp.id, unbilled.id].sort(),
        );
        expect(branchQueue.status).toBe(200);
        expect(branchIds.sort()).toEqual(
            [highPriority.id, overdue.id, incomplete.id, followUp.id, unbilled.id].sort(),
        );
        expect((await request('/bookings?attention=true')).status).toBe(400);
        expect(adminIds).not.toContain(normalFuture.id);
        expect(adminIds).not.toContain(billedCompleted.id);
    });
    it('connects service intake, approved estimates, work orders, inspections, billing, and reports', async () => {
        const siteResponse = await request('/service-sites', {
            customerId,
            branchId,
            name: 'Makati Office',
            address: '120 Ayala Avenue, Makati',
            accessNotes: 'Check in at the lobby desk',
        });
        expect(siteResponse.status).toBe(201);
        const siteId = siteResponse.data.id;

        await db.unit.update({ where: { id: unitId }, data: { serviceSiteId: siteId } });
        const requestBody = {
            branchId,
            customerId,
            serviceSiteId: siteId,
            unitId,
            serviceType: 'Routine Maintenance',
            reportedIssue: 'Indoor unit is not cooling evenly',
            priority: 'HIGH',
            preferredWindowStart: '2030-02-05T00:00:00.000Z',
            preferredWindowEnd: '2030-02-05T02:00:00.000Z',
            internalNotes: 'Call before arrival',
        };
        const siteMismatch = await request('/service-requests', { ...requestBody, customerId: otherCustomerId, unitId: null });
        expect(siteMismatch.status).toBe(400);
        expect((await request('/service-requests', { ...requestBody, branchId: otherBranchId }, 'POST', leader)).status).toBe(403);

        const templateInput = {
            name: 'Routine maintenance ' + randomUUID(),
            serviceType: 'Routine Maintenance',
            items: [
                { label: 'Supply air temperature', type: 'MEASUREMENT', unitLabel: '°C' },
                { label: 'Inspect condensate drain', type: 'CHECK' },
            ],
        };
        expect((await request('/inspection-templates', templateInput, 'POST', leader)).status).toBe(403);
        const template = await request('/inspection-templates', templateInput);
        expect(template.status).toBe(201);

        const created = await request('/service-requests', requestBody);
        expect(created.status).toBe(201);
        const requestId = created.data.id;
        expect(created.data).toMatchObject({
            status: 'NEW',
            serviceAddress: '120 Ayala Avenue, Makati',
            serviceSite: { id: siteId },
            unit: { id: unitId },
        });
        const otherBranchRequest = await request('/service-requests', {
            ...requestBody,
            branchId: otherBranchId,
            serviceSiteId: null,
            unitId: null,
            serviceAddress: '5 Tomas Morato Avenue, Quezon City',
        });
        expect(otherBranchRequest.status).toBe(201);
        const branchRequests = await request('/service-requests?limit=200', undefined, 'GET', leader);
        expect(branchRequests.data.data.map((item: any) => item.id)).toContain(requestId);
        expect(branchRequests.data.data.map((item: any) => item.id)).not.toContain(otherBranchRequest.data.id);
        expect((await request('/service-requests/' + otherBranchRequest.data.id, { internalNotes: 'cross-branch edit' }, 'PATCH', leader)).status).toBe(404);

        expect((await request('/service-requests/' + requestId, { status: 'NEEDS_ASSESSMENT' }, 'PATCH')).status).toBe(200);
        expect((await request('/service-requests/' + requestId, { status: 'NEW' }, 'PATCH')).status).toBe(400);
        const estimate = await request('/service-requests/' + requestId + '/estimate', {
            notes: 'Agreed scope for this service visit',
            lineItems: [
                { description: 'Cleaning and inspection', quantity: '1.250', unitPrice: '800.00' },
                { description: 'Drain treatment', quantity: '1', unitPrice: '125.50' },
            ],
        });
        expect(estimate.status).toBe(201);
        expect(estimate.data.total).toBe('1125.50');
        expect((await request('/estimate-revisions/' + estimate.data.id + '/send', {})).data.status).toBe('SENT');
        const approved = await request('/estimate-revisions/' + estimate.data.id + '/approve', {
            method: 'PHONE',
            contact: 'Test Client',
            note: 'Approval recorded by staff',
        });
        expect(approved.status).toBe(200);
        const requestsAfterApproval = await request('/service-requests?limit=200');
        expect(requestsAfterApproval.data.data.find((item: any) => item.id === requestId).status).toBe('READY_TO_SCHEDULE');
        expect((await request('/service-requests/' + requestId, { status: 'CONVERTED' }, 'PATCH')).status).toBe(400);

        const foreignSite = await request('/service-sites', {
            customerId,
            branchId: otherBranchId,
            name: 'Other branch site',
            address: '5 Tomas Morato Avenue, Quezon City',
        });
        const movedSite = await request('/service-sites', {
            customerId,
            branchId,
            name: 'Makati Office · Updated location',
            address: '22 Makati Avenue, Makati',
            accessNotes: 'Call security before arrival',
        });
        await db.unit.update({ where: { id: unitId }, data: { serviceSiteId: movedSite.data.id } });
        const blockedConversion = await request('/service-requests/' + requestId + '/convert', {
            scheduledAt: '2030-02-05T01:00:00.000Z', technicianId, durationMinutes: 120,
        });
        expect(blockedConversion.status).toBe(400);
        expect((await request('/service-requests/' + requestId, { serviceSiteId: foreignSite.data.id }, 'PATCH')).status).toBe(400);
        const repairedRequest = await request('/service-requests/' + requestId, { serviceSiteId: movedSite.data.id }, 'PATCH');
        expect(repairedRequest.status).toBe(200);
        expect(repairedRequest.data).toMatchObject({
            serviceSiteId: movedSite.data.id,
            serviceAddress: '22 Makati Avenue, Makati',
            accessNotes: 'Call security before arrival',
            unit: { id: unitId, serviceSiteId: movedSite.data.id },
        });
        expect((await request(`/service-sites/${movedSite.data.id}`, { branchId: otherBranchId }, 'PATCH')).status).toBe(409);
        expect((await request(`/units/${unitId}`, { serviceSiteId: foreignSite.data.id }, 'PATCH')).status).toBe(409);

        const conversionBody = {
            scheduledAt: '2030-02-05T01:00:00.000Z',
            technicianId,
            durationMinutes: 120,
            inspectionTemplateId: template.data.id,
        };
        const conversionAttempts = await Promise.all([
            request('/service-requests/' + requestId + '/convert', conversionBody),
            request('/service-requests/' + requestId + '/convert', conversionBody),
        ]);
        expect(conversionAttempts.map((attempt: any) => attempt.status).sort((a: number, b: number) => a - b)).toEqual([200, 201]);
        const conversion = conversionAttempts.find((attempt: any) => attempt.status === 201)!;
        const replay = conversionAttempts.find((attempt: any) => attempt.status === 200)!;
        expect(replay.data.id).toBe(conversion.data.id);
        expect(await db.booking.count({ where: { serviceRequestId: requestId } })).toBe(1);
        const bookingId = conversion.data.id;
        expect(conversion.data).toMatchObject({ status: 'PENDING', estimateRevisionId: estimate.data.id });
        expect(conversion.data.serviceRequest).toMatchObject({
            reportedIssue: 'Indoor unit is not cooling evenly',
            preferredWindowStart: '2030-02-05T00:00:00.000Z',
            preferredWindowEnd: '2030-02-05T02:00:00.000Z',
            accessNotes: 'Call security before arrival',
        });
        expect(conversion.data.estimateRevision.total).toBe('1125.50');
        expect(conversion.data.estimateRevision.lineItems[0]).toMatchObject({ quantity: '1.250', lineTotal: '1000.00' });
        expect(conversion.data.checklist).toEqual([
            expect.objectContaining({ label: 'Supply air temperature', type: 'MEASUREMENT', unitLabel: '°C', reading: '', outcome: 'PENDING' }),
            expect.objectContaining({ label: 'Inspect condensate drain', type: 'CHECK', outcome: 'PENDING' }),
        ]);

        const editedTemplate = await request('/inspection-templates/' + template.data.id, {
            items: [{ label: 'New template item', type: 'CHECK' }],
        }, 'PATCH');
        expect(editedTemplate.status).toBe(200);
        const bookingAfterTemplateEdit = await request('/bookings/' + bookingId);
        expect(bookingAfterTemplateEdit.data.checklist[0].label).toBe('Supply air temperature');
        expect(bookingAfterTemplateEdit.data.serviceRequest.reportedIssue).toBe('Indoor unit is not cooling evenly');

        const part = await request('/inventory', {
            branchId,
            name: 'Test capacitor',
            sku: 'CAP-' + randomUUID(),
            quantityOnHand: 3,
            reorderLevel: 1,
            unitCost: '25.50',
        });
        expect(part.status).toBe(201);
        const used = await request('/bookings/' + bookingId + '/parts', {
            inventoryItemId: part.data.id,
            quantity: 1,
            idempotencyKey: randomUUID(),
        });
        expect(used.status).toBe(201);
        const partsReport = await request('/reports/parts-usage?branchId=' + branchId);
        expect(partsReport.status).toBe(200);
        expect(partsReport.data.data.some((row: any) => row.booking.id === bookingId && row.extendedCost === '25.50')).toBe(true);
        expect((await request('/reports/parts-usage?branchId=' + otherBranchId)).data.data.some((row: any) => row.booking.id === bookingId)).toBe(false);

        expect((await request('/invoices', { bookingId, amount: '1.00' })).status).toBe(400);
        const invoice = await request('/invoices', { bookingId });
        expect(invoice.status).toBe(201);
        expect(invoice.data).toMatchObject({
            amount: '1125.50',
            estimateRevisionId: estimate.data.id,
            lineItems: [
                expect.objectContaining({ description: 'Cleaning and inspection', quantity: '1.250', lineTotal: '1000.00' }),
                expect.objectContaining({ description: 'Drain treatment', lineTotal: '125.50' }),
            ],
        });
        expect(invoice.data.lineItems.every((line: any) => line.sourceLineId)).toBe(true);

        await db.unit.update({ where: { id: unitId }, data: { nextMaintenanceAt: new Date('2030-02-05T00:00:00.000Z') } });
        const due = await request('/reports/maintenance-due?from=2030-02-05&to=2030-02-05');
        expect(due.status).toBe(200);
        expect(due.data).toMatchObject({ branchAttribution: 'ORGANIZATION_WIDE', through: '2030-02-05' });
        const dueUnit = due.data.data.find((item: any) => item.id === unitId);
        expect(dueUnit).toMatchObject({ id: unitId, dueState: 'UPCOMING', customer: { id: customerId } });
        expect((await request('/bookings/' + bookingId, { status: 'CONFIRMED' }, 'PATCH')).status).toBe(200);
        expect((await request('/bookings/' + bookingId, { status: 'ON_SITE' }, 'PATCH')).status).toBe(200);
        expect((await request('/bookings/' + bookingId, { status: 'COMPLETED' }, 'PATCH')).status).toBe(200);
    });

});
