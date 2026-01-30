const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  // 1. Upsert Organization
  const org = await prisma.organization.upsert({
    where: { name: 'Arctic Breeze Services' },
    update: {},
    create: {
      name: 'Arctic Breeze Services',
    },
  });

  // 2. Upsert Branches
  const b1 = await prisma.branch.upsert({
    where: { id: 'north-branch-id' }, // Fixed ID for idempotency
    update: { name: 'North Branch', location: 'Quezon City' },
    create: {
      id: 'north-branch-id',
      name: 'North Branch',
      location: 'Quezon City',
      organizationId: org.id
    }
  });

  const b2 = await prisma.branch.upsert({
    where: { id: 'south-branch-id' },
    update: { name: 'South Branch', location: 'Alabang' },
    create: {
      id: 'south-branch-id',
      name: 'South Branch',
      location: 'Alabang',
      organizationId: org.id
    }
  });

  // 3. Upsert Users
  await prisma.user.upsert({
    where: { email: 'admin@arctic.com' },
    update: { password, role: UserRole.ADMIN },
    create: {
      email: 'admin@arctic.com',
      password,
      role: UserRole.ADMIN,
      organizationId: org.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'north@arctic.com' },
    update: { password, role: UserRole.BRANCH_LEADER, branchId: b1.id },
    create: {
      email: 'north@arctic.com',
      password,
      role: UserRole.BRANCH_LEADER,
      organizationId: org.id,
      branchId: b1.id,
    },
  });

  // 4. Create Customers (Using findFirst to avoid duplicates if ID isn't fixed)
  const customerExists = await prisma.customer.findFirst({ where: { name: 'Juan Dela Cruz' } });
  if (!customerExists) {
    await prisma.customer.create({
      data: { name: 'Juan Dela Cruz', phone: '09171234567', address: '123 Maginhawa St', organizationId: org.id }
    });
  }

  // 5. Create Technicians
  const techExists = await prisma.technician.findFirst({ where: { name: 'Mark Ramos' } });
  if (!techExists) {
    await prisma.technician.create({
      data: { name: 'Mark Ramos', phone: '09188887777', branchId: b1.id }
    });
  }

  console.log('✅ Seeded production-ready Aircon Service data (Idempotent)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });