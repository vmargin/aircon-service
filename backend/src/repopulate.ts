import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting technician repopulation...");

    // 1. Get Organization
    const org = await prisma.organization.findFirst();
    if (!org) {
        console.error("❌ No organization found.");
        return;
    }

    // 2. Define/Create Branches with Fixed IDs for Stability
    const branchConfigs = [
        { id: 'br-north-001', name: 'North Branch', location: 'North District' },
        { id: 'br-south-002', name: 'South Branch', location: 'South District' },
        { id: 'br-east-003', name: 'East Branch', location: 'East District' },
        { id: 'br-west-004', name: 'West Branch', location: 'West District' }
    ];

    const branches = [];
    for (const conf of branchConfigs) {
        const b = await prisma.branch.upsert({
            where: { id: conf.id },
            update: { name: conf.name },
            create: {
                id: conf.id,
                name: conf.name,
                location: conf.location,
                organizationId: org.id
            }
        });
        branches.push(b);
        console.log(`📍 Branch Synced: ${b.name}`);
    }

    // 3. Clear existing technicians to avoid duplicates/confusion
    const deleted = await prisma.technician.deleteMany({});
    console.log(`🧹 Cleared ${deleted.count} old technicians.`);

    // 4. Generate 40 Technicians (10 per branch for balance)
    console.log("👨‍🔧 Generating 40 fresh technicians...");
    const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Matthew', 'Lisa', 'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra', 'Steven', 'Ashley', 'Paul', 'Kimberly', 'Andrew', 'Donna', 'Joshua', 'Emily', 'Kenneth', 'Michelle'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];

    for (let i = 0; i < 40; i++) {
        const fname = firstNames[i % firstNames.length];
        const lname = lastNames[Math.floor(Math.random() * lastNames.length)];
        const name = `${fname} ${lname}`;
        const phone = `09${Math.floor(100000000 + Math.random() * 900000000)}`;
        const branch = branches[i % branches.length]; // Even distribution

        await prisma.technician.create({
            data: {
                name,
                phone,
                branchId: branch.id,
                isActive: true
            }
        });
    }

    // 5. Align any Branch Leader to North Branch
    const leader = await prisma.user.findFirst({
        where: { role: UserRole.BRANCH_LEADER }
    });

    if (leader) {
        await prisma.user.update({
            where: { id: leader.id },
            data: { branchId: 'br-north-001' }
        });
        console.log(`✅ Aligned Leader ${leader.email} to North Branch.`);
    }

    console.log("✨ POPULATION COMPLETE: 40 Technicians created across 4 branches.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
