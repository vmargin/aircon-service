import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seed() {
    const demoPassword = process.env.DEMO_ADMIN_PASSWORD || 'demo123';
    const hashedPassword = await bcrypt.hash(demoPassword, 10);

    // 1. Create Organization
    const org = await prisma.organization.upsert({
        where: { name: 'Arctic Aircon' },
        update: {},
        create: {
            name: 'Arctic Aircon',
        },
    });

    // 2. Create Admin User
    await prisma.user.upsert({
        where: { email: 'admin@arctic.com' },
        update: {},
        create: {
            email: 'admin@arctic.com',
            password: hashedPassword,
            role: 'ADMIN',
            organizationId: org.id,
        },
    });

    // 3. Create Branches
    const branches = [
        { name: 'North Branch', location: 'Yishun / Woodlands' },
        { name: 'South Branch', location: 'Marina Bay / Sentosa' },
        { name: 'East Branch', location: 'Tampines / Changi' },
        { name: 'West Branch', location: 'Jurong / Clementi' },
    ];

    for (const branchData of branches) {
        const branch = await prisma.branch.create({
            data: {
                name: branchData.name,
                location: branchData.location,
                organizationId: org.id,
            },
        });

        console.log(`Created branch: ${branch.name}`);

        // 4. Create Branch Manager (User)
        const managerEmail = `${branchData.name.split(' ')[0].toLowerCase()}@arctic.com`;
        await prisma.user.create({
            data: {
                email: managerEmail,
                password: hashedPassword,
                role: 'BRANCH_LEADER',
                organizationId: org.id,
                branchId: branch.id,
            },
        });

        console.log(`Created manager: ${managerEmail}`);

        // 5. Create Technicians
        const techs = ['Tech A', 'Tech B', 'Tech C', 'Tech D', 'Tech E', 'Tech F'];
        for (const techName of techs) {
            await prisma.technician.create({
                data: {
                    name: `${techName} (${branchData.name.split(' ')[0]})`,
                    phone: '91234567',
                    branchId: branch.id,
                    isActive: true,
                },
            });
        }
        console.log(`Created 3 technicians for ${branch.name}`);
        // 6. Create Customers
        const customer = await prisma.customer.create({
            data: {
                name: `Test Customer (${branchData.name.split(' ')[0]})`,
                phone: '88887777',
                address: `Address in ${branchData.name}`,
                organizationId: org.id,
            },
        });
        console.log(`Created customer for ${branch.name}`);

        // 7. Create a Booking
        await prisma.booking.create({
            data: {
                serviceType: 'Maintenance',
                status: 'PENDING',
                scheduledAt: new Date(Date.now() + 86400000), // Tomorrow
                customerId: customer.id,
                branchId: branch.id,
                customerName: customer.name,
                phone: customer.phone,
                address: customer.address,
            },
        });
        console.log(`Created booking for ${branch.name}`);
    }
}

// Check if this script is being run directly
const isDirectRun = require.main === module;

if (isDirectRun) {
    seed()
        .catch((e) => {
            console.error(e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}