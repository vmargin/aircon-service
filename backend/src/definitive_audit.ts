import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    console.log("--- DEFINITIVE STAFF AUDIT ---");
    const tcount = await prisma.technician.count();
    const bcount = await prisma.branch.count();
    const ucount = await prisma.user.count();

    console.log(`Total Technicians: ${tcount}`);
    console.log(`Total Branches: ${bcount}`);
    console.log(`Total Users: ${ucount}`);

    const branches = await prisma.branch.findMany({
        include: { _count: { select: { technicians: true } } }
    });
    console.log("\nBranch Breakdown:");
    branches.forEach(b => {
        console.log(` - ${b.name} (id: ${b.id}): ${b._count.technicians} techs`);
    });

    const users = await prisma.user.findMany({
        select: { email: true, role: true, branchId: true }
    });
    console.log("\nUser Breakdown:");
    users.forEach(u => {
        console.log(` - ${u.email}: Role=${u.role}, BranchId=${u.branchId}`);
    });
}
run().finally(() => prisma.$disconnect());
