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
            db.user.create({ data: { email: `branchless-${fixture}@example.com`, password: hashed, role: 'BRANCH_LEADER', organizationId: orgId } }),
        ]);
        const sign = (user: typeof users[number]) => jwt.sign({ userId: user.id, orgId: user.organizationId, role: user.role, branchId: user.branchId } satisfies AuthUser, secret);
        admin = sign(users[0]); leader = sign(users[1]); branchless = sign(users[2]);
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
            await db.invoice.deleteMany({ where: { booking: scope } });
            await db.booking.deleteMany({ where: scope });
            await db.inventoryItem.deleteMany({ where: scope });
            await db.unit.deleteMany({ where: { organizationId: orgId } });
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
        expect((await request(`/bookings/${mainBooking}`, { status: 'COMPLETED' }, 'PATCH')).status).toBe(400);
        const update = await request(`/bookings/${mainBooking}`, { diagnosis: 'Filter requires replacement', checklist: [{ id: 'filter', label: 'Inspect air filter', checked: true }] }, 'PATCH');
        expect(update.data.durationMinutes).toBe(120);
        expect(update.data.checklist[0].checked).toBe(true);
        expect((await request(`/units/${unitId}`, { customerId: otherCustomerId }, 'PATCH')).status).toBe(400);
    });

    it('atomically consumes stock with movements and prevents negative inventory', async () => {
        const create = await request('/inventory', { branchId, name: 'Air filter', sku: 'TEST-FILTER', quantityOnHand: 5, reorderLevel: 2, unitCost: 12.25 });
        expect(create.status).toBe(201);
        itemId = create.data.id;
        const use = () => request(`/bookings/${mainBooking}/parts`, { inventoryItemId: itemId, quantity: 4 });
        expect((await Promise.all([use(), use()])).map((result) => result.status).sort()).toEqual([201, 409]);
        expect((await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantityOnHand).toBe(1);
        expect((await request(`/inventory/${itemId}/restock`, { quantity: -2 }, 'PATCH')).status).toBe(400);
        expect((await request(`/inventory/${itemId}/restock`, { quantity: 2 }, 'PATCH')).data.quantityOnHand).toBe(3);
        expect((await db.stockMovement.findMany({ where: { inventoryItemId: itemId } })).map((movement) => movement.quantity).sort((a, b) => a - b)).toEqual([-4, 2, 5]);
    });

    it('issues one invoice per job and derives exact partial receipts with idempotency', async () => {
        const created = await request('/invoices', { bookingId: mainBooking, amount: 100.10 });
        expect(created.status).toBe(201);
        invoiceId = created.data.id;
        expect(created.data.amount).toBe('100.10');
        expect((await request('/invoices', { bookingId: mainBooking, amount: 100 })).status).toBe(409);
        expect((await request(`/bookings/${mainBooking}/parts`, { inventoryItemId: itemId, quantity: 1 })).status).toBe(400);
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
});
