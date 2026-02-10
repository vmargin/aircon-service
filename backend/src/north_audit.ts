import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    console.log("--- NORTH BRANCH AUDIT ---");

    // 1. Get the North Branch
    const northBranch = await prisma.branch.findFirst({
        where: { name: { contains: 'North' } }
    });
    console.log("North Branch:", JSON.stringify(northBranch, null, 2));

    // 2. Get the User(s)
    const users = await prisma.user.findMany({
        where: { branchId: northBranch?.id }
    });
    console.log("Users in North Branch:", JSON.stringify(users.map(u => ({ email: u.email, bId: u.branchId })), null, 2));

    // 3. Get Technicians in North Branch
    const techs = await prisma.technician.findMany({
        where: { branchId: northBranch?.id }
    });
    console.log("Technicians in North Branch:", techs.length);
    if (techs.length > 0) {
        console.log("Sample Tech BranchId:", techs[0].branchId);
    }

    // 4. Check if there are ANY users with a different North Branch ID (potential duplicates)
    const allNorthBranches = await prisma.branch.findMany({
        where: { name: { contains: 'North' } }
    });
    console.log("All North-like Branches:", JSON.stringify(allNorthBranches.map(b => ({ name: b.name, id: b.id })), null, 2));
}
run().finally(() => prisma.$disconnect());
