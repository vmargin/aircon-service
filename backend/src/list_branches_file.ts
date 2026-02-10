import { PrismaClient } from '@prisma/client';
import fs from 'fs';
const prisma = new PrismaClient();
async function run() {
    const branches = await prisma.branch.findMany({
        include: {
            _count: {
                select: { technicians: true, bookings: true, users: true }
            }
        }
    });
    const data = branches.map(b => ({
        id: b.id,
        name: b.name,
        techs: b._count.technicians,
        bookings: b._count.bookings,
        users: b._count.users
    }));
    fs.writeFileSync('branch_audit.json', JSON.stringify(data, null, 2));
    console.log("Written to branch_audit.json");
}
run().finally(() => prisma.$disconnect());
