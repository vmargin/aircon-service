import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    console.log("--- CLEAN BRANCH LIST ---");
    const branches = await prisma.branch.findMany({
        include: {
            _count: {
                select: { technicians: true, bookings: true, users: true }
            }
        }
    });
    branches.forEach(b => {
        console.log(`ID: ${b.id} | Name: "${b.name}" | Techs: ${b._count.technicians} | Bookings: ${b._count.bookings} | Users: ${b._count.users}`);
    });
}
run().finally(() => prisma.$disconnect());
