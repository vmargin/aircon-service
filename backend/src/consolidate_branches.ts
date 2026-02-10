import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    console.log("🚀 Starting Branch Consolidation...");

    const mapping = [
        { id: 'br-north-001', search: 'North', newName: 'North' },
        { id: 'br-south-002', search: 'South', newName: 'South' },
        { id: 'br-east-003', search: 'East', newName: 'East' },
        { id: 'br-west-004', search: 'West', newName: 'West' },
    ];

    for (const target of mapping) {
        console.log(`\n📂 Consolidating to "${target.newName}" (${target.id})...`);

        // 1. Update target branch name
        await prisma.branch.update({
            where: { id: target.id },
            data: { name: target.newName }
        });

        // 2. Find all OTHER branches with similar names
        const others = await prisma.branch.findMany({
            where: {
                name: { contains: target.search },
                id: { not: target.id }
            }
        });

        const otherIds = others.map(o => o.id);
        if (otherIds.length === 0) {
            console.log(`  No duplicates found for ${target.search}.`);
            continue;
        }

        console.log(`  Merging ${otherIds.length} branches: ${others.map(o => o.name).join(', ')}`);

        // 3. Move Bookings
        const bookings = await prisma.booking.updateMany({
            where: { branchId: { in: otherIds } },
            data: { branchId: target.id }
        });
        console.log(`  ✅ Moved ${bookings.count} bookings.`);

        // 4. Move Technicians
        const techs = await prisma.technician.updateMany({
            where: { branchId: { in: otherIds } },
            data: { branchId: target.id }
        });
        console.log(`  ✅ Moved ${techs.count} technicians.`);

        // 5. Move Users
        const users = await prisma.user.updateMany({
            where: { branchId: { in: otherIds } },
            data: { branchId: target.id }
        });
        console.log(`  ✅ Moved ${users.count} users.`);

        // 6. Delete redundant branches
        await prisma.branch.deleteMany({
            where: { id: { in: otherIds } }
        });
        console.log(`  🗑️ Deleted ${otherIds.length} redundant branch records.`);
    }

    console.log("\n✨ Consolidation Complete!");
}

run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
