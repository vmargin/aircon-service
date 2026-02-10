import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
    console.log("--- DIAGNOSTICS ---");
    const org = await prisma.organization.findFirst();
    console.log("Organization:", org?.name, org?.id);

    const bcount = await prisma.branch.count();
    console.log("Total Branches:", bcount);

    const tcount = await prisma.technician.count();
    console.log("Total Technicians:", tcount);

    const bookCount = await prisma.booking.count();
    console.log("Total Bookings:", bookCount);

    const firstBooking = await prisma.booking.findFirst();
    if (firstBooking) {
        console.log("First Booking BranchId:", firstBooking.branchId);
        const techsInThatBranch = await prisma.technician.count({
            where: { branchId: firstBooking.branchId }
        });
        console.log("Technicians in that Branch:", techsInThatBranch);
    }

    const allTechs = await prisma.technician.findMany({ take: 3 });
    console.log("Sample Techs:", JSON.stringify(allTechs.map(t => ({ name: t.name, bId: t.branchId, active: t.isActive })), null, 2));

    const allBranches = await prisma.branch.findMany({
        include: { _count: { select: { technicians: true } } }
    });
    console.log("Branch Detail:", JSON.stringify(allBranches.map(b => ({ name: b.name, id: b.id, techCount: b._count.technicians })), null, 2));
}
run().finally(() => prisma.$disconnect());
