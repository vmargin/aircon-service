import { PrismaClient, BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * SEED
 *
 * Fully idempotent — every write is an upsert keyed on a natural unique field,
 * so `npm run db:seed` can be run repeatedly without failing.
 *
 * The previous version used `create` and gave all four demo customers the same
 * phone number, which violates the (organizationId, phone) unique constraint
 * and killed the script on the second branch.
 */

const ORG_NAME = 'Arctic Aircon';

const BRANCHES = [
    { key: 'north', name: 'North Branch', location: 'Quezon City' },
    { key: 'south', name: 'South Branch', location: 'Makati / BGC' },
    { key: 'east', name: 'East Branch', location: 'Pasig / Marikina' },
    { key: 'west', name: 'West Branch', location: 'Manila / Cavite' },
] as const;

/** Three technicians per branch, with unique names and phones. */
const TECHS_PER_BRANCH = [
    { suffix: 'Reyes', phone: '0917' },
    { suffix: 'Santos', phone: '0918' },
    { suffix: 'Cruz', phone: '0919' },
] as const;

const SERVICE_TYPES = ['Cleaning', 'Repair', 'Installation', 'Maintenance'] as const;

function daysFromNow(days: number, hour = 9) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
}

async function main() {
    const password = process.env.DEMO_ADMIN_PASSWORD || 'demo1234';
    const hashed = await bcrypt.hash(password, 10);

    // --- Organization ------------------------------------------------------
    const org = await prisma.organization.upsert({
        where: { name: ORG_NAME },
        update: {},
        create: { name: ORG_NAME },
    });

    // --- Admin (sees every branch) ----------------------------------------
    await prisma.user.upsert({
        where: { email: 'admin@arctic.com' },
        update: { password: hashed, role: 'ADMIN', organizationId: org.id, branchId: null },
        create: {
            email: 'admin@arctic.com',
            password: hashed,
            role: 'ADMIN',
            organizationId: org.id,
        },
    });
    console.log('✓ admin@arctic.com (ADMIN)');

    let customerCounter = 0;

    for (const [branchIndex, b] of BRANCHES.entries()) {
        // Branch has no natural unique key in the schema, so find-then-create.
        const existing = await prisma.branch.findFirst({
            where: { name: b.name, organizationId: org.id },
        });

        const branch =
            existing ??
            (await prisma.branch.create({
                data: { name: b.name, location: b.location, organizationId: org.id },
            }));

        // --- Branch leader (sees only this branch) ------------------------
        const leaderEmail = `${b.key}@arctic.com`;
        await prisma.user.upsert({
            where: { email: leaderEmail },
            update: {
                password: hashed,
                role: 'BRANCH_LEADER',
                organizationId: org.id,
                branchId: branch.id,
            },
            create: {
                email: leaderEmail,
                password: hashed,
                role: 'BRANCH_LEADER',
                organizationId: org.id,
                branchId: branch.id,
            },
        });

        // --- Technicians --------------------------------------------------
        const technicians = [];
        for (const [techIndex, t] of TECHS_PER_BRANCH.entries()) {
            const name = `${t.suffix}, ${b.name.split(' ')[0]}`;
            const found = await prisma.technician.findFirst({
                where: { name, branchId: branch.id },
            });

            technicians.push(
                found ??
                    (await prisma.technician.create({
                        data: {
                            name,
                            // Unique, plausible PH mobile numbers.
                            phone: `${t.phone}${String(1000000 + branchIndex * 10 + techIndex).slice(-7)}`,
                            branchId: branch.id,
                        },
                    }))
            );
        }

        // --- Customers (unique phone per org) -----------------------------
        const customers = [];
        for (let i = 0; i < 3; i++) {
            customerCounter += 1;
            const phone = `09${String(200000000 + customerCounter).slice(-9)}`;
            customers.push(
                await prisma.customer.upsert({
                    where: { organizationId_phone: { organizationId: org.id, phone } },
                    update: {},
                    create: {
                        name: `Customer ${customerCounter} (${b.name.split(' ')[0]})`,
                        phone,
                        address: `${100 + customerCounter} Sample St, ${b.location}`,
                        organizationId: org.id,
                    },
                })
            );
        }

        // --- Bookings ------------------------------------------------------
        // Only seed bookings the first time this branch is created, so
        // re-running the seed doesn't pile up duplicates.
        const bookingCount = await prisma.booking.count({ where: { branchId: branch.id } });
        if (bookingCount > 0) {
            console.log(`✓ ${b.name} (already seeded, skipping bookings)`);
            continue;
        }

        // One of each lifecycle stage so the dashboard has something to show.
        const plan = [
            { status: BookingStatus.PENDING, day: 2, tech: null, invoice: null },
            { status: BookingStatus.CONFIRMED, day: 4, tech: 0, invoice: null },
            { status: BookingStatus.ON_SITE, day: 0, tech: 1, invoice: null },
            {
                status: BookingStatus.COMPLETED,
                day: -3,
                tech: 2,
                invoice: { amount: '3500.00', paid: true },
            },
            {
                status: BookingStatus.COMPLETED,
                day: -8,
                tech: 0,
                invoice: { amount: '1800.50', paid: false },
            },
        ] as const;

        for (const [i, p] of plan.entries()) {
            const booking = await prisma.booking.create({
                data: {
                    serviceType: SERVICE_TYPES[i % SERVICE_TYPES.length],
                    status: p.status,
                    scheduledAt: daysFromNow(p.day, 9 + i),
                    customerId: customers[i % customers.length].id,
                    branchId: branch.id,
                    technicianId: p.tech === null ? null : technicians[p.tech].id,
                },
            });

            if (p.invoice) {
                await prisma.invoice.create({
                    data: {
                        bookingId: booking.id,
                        amount: new Prisma.Decimal(p.invoice.amount),
                        paymentStatus: p.invoice.paid ? PaymentStatus.PAID : PaymentStatus.UNPAID,
                        paymentMethod: p.invoice.paid ? 'CASH' : null,
                        paidAt: p.invoice.paid ? daysFromNow(p.day + 1) : null,
                    },
                });
            }
        }

        console.log(`✓ ${b.name} — ${leaderEmail}, 3 techs, 3 customers, 5 bookings`);
    }

    console.log('\nSeed complete. Log in with:');
    console.log(`  admin@arctic.com / ${password}   (sees all branches)`);
    console.log(`  north@arctic.com / ${password}   (sees North Branch only)`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
