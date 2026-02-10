import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const branches = await prisma.branch.findMany({
        include: { _count: { select: { technicians: true } } }
    });
    console.log('--- BRANCHES ---');
    branches.forEach(b => console.log(`${b.name} (${b.id}): ${b._count.technicians} techs`));

    const bookings = await prisma.booking.findMany({
        take: 10,
        include: { branch: true }
    });
    console.log('\n--- RECENT BOOKINGS ---');
    bookings.forEach(bk => console.log(`Booking ${bk.id} in branch: ${bk.branch.name} (${bk.branchId})`));
}
run().finally(() => prisma.$disconnect());
