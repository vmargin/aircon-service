import { BookingPriority, BookingStatus, PaymentStatus, Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function guardLocalDemo() {
    const database = new URL(process.env.DATABASE_URL ?? '');
    if (process.env.ARCTIC_LOCAL !== '1' || process.env.ALLOW_DEMO_SEED !== 'true' || !['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/arctic_dev') {
        throw new Error('Demo seed requires explicit permission and the dedicated local arctic_dev database.');
    }
}

function manilaDate(offset: number, hour = 9, monthOffset = 0) {
    const local = new Date(Date.now() + 8 * 60 * 60_000);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + monthOffset, local.getUTCDate() + offset, hour - 8));
}

const checklist = [
    { id: 'visual', label: 'Inspect indoor and outdoor unit', checked: true },
    { id: 'filter', label: 'Clean air filters and drain pan', checked: true },
    { id: 'temperature', label: 'Record supply and return air temperatures', checked: false },
    { id: 'refrigerant', label: 'Check refrigerant pressure and signs of leaks', checked: false },
    { id: 'electrical', label: 'Inspect wiring and electrical connections', checked: false },
    { id: 'drain', label: 'Test condensate drain and operation', checked: false },
];

async function main() {
    guardLocalDemo();
    const password = await bcrypt.hash('demo1234', 10);
    await prisma.$transaction(async (tx) => {
        // A fresh local database only. Reopening the app never rewrites data,
        // resets passwords, or moves demo appointments to the current date.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(98422374)::text AS locked`;
        if (await tx.organization.count() > 0) {
            console.log('Local database already contains data; demo seed skipped.');
            return;
        }
        const org = await tx.organization.create({ data: { name: 'ARCTIC Aircon Services · Demo' } });
        const makati = await tx.branch.create({ data: { name: 'Makati Branch', location: 'Makati / BGC', organizationId: org.id } });
        const qc = await tx.branch.create({ data: { name: 'Quezon City Branch', location: 'Quezon City / Marikina', organizationId: org.id } });
        const admin = await tx.user.create({ data: { email: 'admin@arctic.com', password, role: 'ADMIN', organizationId: org.id } });
        await tx.user.createMany({ data: [ { email: 'south@arctic.com', password, role: 'BRANCH_LEADER', organizationId: org.id, branchId: makati.id }, { email: 'north@arctic.com', password, role: 'BRANCH_LEADER', organizationId: org.id, branchId: qc.id } ] });
        const technicians = [];
        for (const [i, name] of ['Daniel Cruz', 'Miguel Santos', 'Ryan Lim', 'Aaron Wong', 'Sofia Reyes', 'Paolo Garcia'].entries()) {
            technicians.push(await tx.technician.create({ data: { name, phone: `0917000000${i}`, branchId: i < 4 ? makati.id : qc.id, specialty: ['Preventive maintenance', 'Diagnostics & installation', 'Repairs & refrigeration'][i % 3] } }));
        }
        const customers = [];
        const units = [];
        const clients = [
            { name: 'Lee Residence', address: 'Salcedo Village, Makati City', type: 'Residential', contact: 'Andrea Lee' },
            { name: 'Skyline Office', address: 'Bonifacio Global City, Taguig', type: 'Commercial', contact: 'Marcus Santos' },
            { name: 'Harper Café', address: 'Poblacion, Makati City', type: 'Commercial', contact: 'Audrey Reyes' },
            { name: 'One Raffles Tower', address: 'Legazpi Village, Makati City', type: 'Commercial', contact: 'Angela Tan' },
            { name: 'Parkside Studio', address: 'Kapitolyo, Pasig City', type: 'Commercial', contact: 'Nicole Lim' },
            { name: 'Cedar Family Home', address: 'Diliman, Quezon City', type: 'Residential', contact: 'Robert Cruz' },
            { name: 'Northpoint Dental', address: 'Cubao, Quezon City', type: 'Commercial', contact: 'Jamie Reyes' },
            { name: 'The Greenhouse', address: 'Loyola Heights, Quezon City', type: 'Residential', contact: 'Claire Garcia' },
        ];
        for (const [i, client] of clients.entries()) {
            const customer = await tx.customer.create({ data: { name: client.name, phone: `0920000000${i}`, address: client.address, type: client.type, contactPerson: client.contact, email: `client${i + 1}@example.com`, organizationId: org.id } });
            customers.push(customer);
            const brand = ['Daikin', 'Mitsubishi', 'LG', 'Carrier'][i % 4];
            units.push(await tx.unit.create({ data: { name: `${brand} ${i % 2 === 0 ? 'Wall-mounted' : 'Ceiling cassette'}`, brand, model: ['FTKF25', 'MSY-GR13', 'HS12', '42QHC'][i % 4], serialNumber: `DEMO-AC-${String(i + 1).padStart(4, '0')}`, type: i % 2 === 0 ? 'Split type' : 'Ceiling cassette', capacity: i % 2 === 0 ? '1.5 HP' : '3.0 HP', location: ['Living room', 'Main office', 'Dining area', 'Lobby'][i % 4], installedAt: manilaDate(-400 - i * 20), nextMaintenanceAt: manilaDate(i - 3), customerId: customer.id, organizationId: org.id } }));
        }
        const items = [];
        for (const branch of [makati, qc]) {
            for (const [i, item] of [
                { name: 'Air filter · Universal', sku: 'AF-100', qty: 24, cost: '450.00', unit: 'pcs' },
                { name: 'Capacitor · 35µF / 450V', sku: 'CAP-35', qty: 3, cost: '380.00', unit: 'pcs' },
                { name: 'Refrigerant R32', sku: 'R32-10KG', qty: 12, cost: '850.00', unit: 'kg' },
                { name: 'Condenser coil cleaner', sku: 'CLN-COIL', qty: 19, cost: '290.00', unit: 'bottles' },
                { name: 'Drain hose · 16 mm', sku: 'DRAIN-16', qty: 4, cost: '120.00', unit: 'meters' },
            ].entries()) {
                const inventory = await tx.inventoryItem.create({ data: { name: item.name, sku: item.sku, quantityOnHand: item.qty, reorderLevel: i === 2 ? 3 : 5, unitCost: new Prisma.Decimal(item.cost), unit: item.unit, branchId: branch.id } });
                await tx.stockMovement.create({ data: { inventoryItemId: inventory.id, quantity: item.qty, reason: 'Synthetic demo opening stock' } });
                items.push(inventory);
            }
        }
        const services = ['Routine Maintenance', 'System Inspection', 'Repair - Not Cooling', 'Installation', 'Chemical Cleaning'];
        async function invoiceFor(bookingId: string, amount: Prisma.Decimal, paidFraction: number, issuedAt: Date) {
            const paid = amount.mul(paidFraction).toDecimalPlaces(2);
            const invoice = await tx.invoice.create({ data: { bookingId, amount, ledgerEnabled: true, issuedAt, paymentStatus: paid.eq(amount) ? PaymentStatus.PAID : paid.gt(0) ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID, paymentMethod: paid.gt(0) ? 'BANK' : null, paidAt: paid.eq(amount) ? issuedAt : null } });
            if (paid.gt(0)) await tx.payment.create({ data: { invoiceId: invoice.id, amount: paid, method: 'BANK', reference: 'Synthetic demo receipt', idempotencyKey: `seed-${invoice.id}`, createdAt: issuedAt } });
            return invoice;
        }
        for (let month = -5; month <= 0; month++) {
            for (let j = 0; j < 10; j++) {
                const clientIndex = j % customers.length;
                const north = clientIndex >= 5;
                const tech = north ? technicians[4 + j % 2] : technicians[j % 4];
                const scheduledAt = manilaDate(-12 - j, 9 + j % 3, month);
                const booking = await tx.booking.create({ data: { serviceType: services[j % services.length], status: BookingStatus.COMPLETED, scheduledAt, customerId: customers[clientIndex].id, unitId: units[clientIndex].id, branchId: north ? qc.id : makati.id, technicianId: tech.id, diagnosis: 'Preventive service completed. Airflow and drain operation checked.', checklist: checklist.map((entry) => ({ ...entry, checked: true })), notes: 'Synthetic demonstration record.' } });
                await invoiceFor(booking.id, new Prisma.Decimal(1800 + j * 550 + (month + 5) * 150), j % 4 === 0 ? 0.5 : j % 5 === 0 ? 0 : 1, scheduledAt);
            }
        }
        const todayPlan = [
            { client: 0, tech: 0, hour: 9, status: BookingStatus.COMPLETED, service: 0 },
            { client: 1, tech: 1, hour: 11, status: BookingStatus.ON_SITE, service: 1 },
            { client: 2, tech: 2, hour: 14, status: BookingStatus.ON_SITE, service: 2 },
            { client: 3, tech: 3, hour: 16, status: BookingStatus.CONFIRMED, service: 0 },
            { client: 4, tech: 0, hour: 14, status: BookingStatus.CONFIRMED, service: 4 },
            { client: 5, tech: 4, hour: 9, status: BookingStatus.COMPLETED, service: 0 },
            { client: 6, tech: 5, hour: 11, status: BookingStatus.CONFIRMED, service: 1 },
            { client: 7, tech: 4, hour: 14, status: BookingStatus.PENDING, service: 3 },
        ];
        for (const plan of todayPlan) {
            const customer = customers[plan.client];
            const branch = plan.client >= 5 ? qc : makati;
            const scheduledAt = manilaDate(0, plan.hour);
            const booking = await tx.booking.create({ data: { serviceType: services[plan.service], status: plan.status, scheduledAt, customerId: customer.id, unitId: units[plan.client].id, branchId: branch.id, technicianId: technicians[plan.tech].id, priority: plan.client === 2 ? BookingPriority.HIGH : BookingPriority.NORMAL, diagnosis: plan.client === 2 ? 'Weak cooling reported. Inspect capacitor and refrigerant pressure.' : null, notes: plan.client === 2 ? 'Client reports warm air and unusual outdoor-unit noise.' : 'Please call the contact person on arrival.', checklist: checklist.map((entry) => ({ ...entry, checked: plan.status === BookingStatus.COMPLETED || entry.checked })) } });
            if (plan.status === BookingStatus.COMPLETED || plan.client === 2) await invoiceFor(booking.id, new Prisma.Decimal(plan.client === 2 ? 8500 : 2400), plan.status === BookingStatus.COMPLETED ? 1 : 0, scheduledAt);
            await tx.auditLog.create({ data: { userId: admin.id, action: plan.status === BookingStatus.PENDING ? 'BOOKING_CREATE' : 'BOOKING_UPDATE', resourceType: 'booking', resourceId: booking.id, branchId: branch.id, details: `${customer.name} · ${services[plan.service]} · ${plan.status.replace('_', ' ').toLowerCase()}`, createdAt: new Date(Date.now() - (8 - plan.client) * 60_000) } });
            if (plan.client === 2) {
                await tx.partUsage.create({ data: { bookingId: booking.id, inventoryItemId: items[1].id, quantity: 1, unitPrice: items[1].unitCost } });
                await tx.inventoryItem.update({ where: { id: items[1].id }, data: { quantityOnHand: { decrement: 1 } } });
                await tx.stockMovement.create({ data: { inventoryItemId: items[1].id, quantity: -1, reason: 'Synthetic demo service part', bookingId: booking.id } });
            }
        }
        for (let day = 1; day <= 5; day++) {
            const client = day % 5;
            await tx.booking.create({ data: { serviceType: services[day % services.length], scheduledAt: manilaDate(day, 9 + day), customerId: customers[client].id, unitId: units[client].id, branchId: makati.id, technicianId: technicians[day % 4].id, status: BookingStatus.CONFIRMED, notes: 'Upcoming synthetic demo appointment.', checklist } });
        }
        console.log('Synthetic local demo seeded: 2 branches, 6 technicians, 8 clients, units, stock, jobs and receipt history.');
    }, { timeout: 60_000 });
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
