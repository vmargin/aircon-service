import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    console.log("--- BRANCH DUPLICATION AUDIT ---");
    const branches = await prisma.branch.findMany({
        include: { _count: { select: { technicians: true, bookings: true, users: true } } }
    });
    console.log(`Total Branch Records: ${branches.length}\n`);
    branches.forEach(b => {
        console.log(`- [${b.id}] "${b.name}"`);
        console.log(`  Techs: ${b._count.technicians} | Bookings: ${b._count.bookings} | Users: ${b._count.users}`);
    });
}
run().finally(() => prisma.$disconnect());
