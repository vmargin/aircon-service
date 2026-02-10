import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    console.log("🛠️ Starting data alignment fix...");

    // 1. Get the North Branch (or any branch that HAS technicians)
    const activeBranch = await prisma.branch.findFirst({
        where: { name: 'North Branch' }
    });

    if (!activeBranch) {
        console.error("❌ North Branch not found! Did you run the seed script?");
        return;
    }

    // 2. Find all bookings that are NOT in a branch with technicians
    // For simplicity, we'll just move ALL existing bookings to the North Branch 
    // to ensure they are testable.
    const result = await prisma.booking.updateMany({
        data: {
            branchId: activeBranch.id
        }
    });

    console.log(`✅ Successfully moved ${result.count} bookings to North Branch (${activeBranch.id}).`);
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
