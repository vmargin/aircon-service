import { PrismaClient, UserRole } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    console.log("🛠️ Aligning Branch Leader...");

    // 1. Get the North Branch
    const northBranch = await prisma.branch.findFirst({
        where: { name: 'North Branch' }
    });

    if (!northBranch) {
        console.error("❌ North Branch not found.");
        return;
    }

    // 2. Get the first Branch Leader
    const leader = await prisma.user.findFirst({
        where: { role: UserRole.BRANCH_LEADER }
    });

    if (!leader) {
        console.error("❌ No Branch Leader found.");
        return;
    }

    // 3. Update the leader's branchId
    await prisma.user.update({
        where: { id: leader.id },
        data: { branchId: northBranch.id }
    });

    console.log(`✅ Aligned ${leader.email} to North Branch (${northBranch.id})`);

    // 4. Also move all bookings to this branch just in case
    const bRes = await prisma.booking.updateMany({
        data: { branchId: northBranch.id }
    });
    console.log(`✅ Moved ${bRes.count} bookings to North Branch.`);
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
