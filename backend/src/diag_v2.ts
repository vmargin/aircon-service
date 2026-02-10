import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    const branches = await prisma.branch.findMany({
        include: { _count: { select: { technicians: true } } }
    });
    console.log('--- BRANCHES ---');
    branches.forEach(b => console.log(JSON.stringify({ name: b.name, id: b.id, count: b._count.technicians })));

    const bookings = await prisma.booking.findMany({
        include: { branch: true }
    });
    console.log('\n--- BOOKINGS ---');
    bookings.forEach(bk => console.log(JSON.stringify({ id: bk.id, branch: bk.branch.name, branchId: bk.branchId })));
}
run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
