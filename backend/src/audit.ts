import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    console.log("--- SYSTEM USER & BRANCH AUDIT ---");
    const users = await prisma.user.findMany({
        select: { email: true, role: true, branchId: true }
    });
    console.log("Users:", JSON.stringify(users, null, 2));

    const branches = await prisma.branch.findMany({
        include: { _count: { select: { technicians: true } } }
    });
    console.log("Branches & Tech Counts:", JSON.stringify(branches.map(b => ({
        name: b.name,
        id: b.id,
        techs: b._count.technicians
    })), null, 2));

    const bookings = await prisma.booking.findMany({
        take: 5,
        select: { id: true, branchId: true, branch: { select: { name: true } } }
    });
    console.log("Recent Bookings:", JSON.stringify(bookings, null, 2));
}
run().finally(() => prisma.$disconnect());
