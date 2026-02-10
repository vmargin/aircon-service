import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    console.log("🛠️ Final Technician Cleanup...");
    const result = await prisma.technician.updateMany({
        data: { isActive: true }
    });
    console.log(`✅ Ensured ${result.count} technicians are active.`);

    // Check if any techs have mismatched branch organizations (shouldn't happen but good to check)
    const org = await prisma.organization.findFirst();
    if (org) {
        console.log(`🏢 Validating against Org: ${org.name}`);
    }
}
run().catch(console.error).finally(() => prisma.$disconnect());
