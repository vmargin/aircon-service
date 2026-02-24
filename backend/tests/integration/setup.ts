import { PrismaClient } from '@prisma/client';
import { seed } from '../../prisma/seed';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn', 'info'],
});

// Ensure consistent JWT secret for tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'arctic_secret_key_2024';

// Set global timeout for all tests and hooks
jest.setTimeout(30000);

// Test database setup
export async function setupTestDatabase() {
  // Clear all data
  await prisma.auditLog.deleteMany();
  await prisma.inventoryUsage.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.technician.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.organization.deleteMany();

  // Seed with test data
  await seed();
}

export async function clearTestData() {
  // Clear all data
  await prisma.auditLog.deleteMany();
  await prisma.inventoryUsage.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.technician.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.organization.deleteMany();
}

export async function getTestData() {
  const data = {
    organizations: await prisma.organization.findMany(),
    branches: await prisma.branch.findMany(),
    users: await prisma.user.findMany(),
    technicians: await prisma.technician.findMany(),
    customers: await prisma.customer.findMany(),
    bookings: await prisma.booking.findMany(),
    invoices: await prisma.invoice.findMany(),
    auditLogs: await prisma.auditLog.findMany(),
  };
  return data;
}

export { prisma };