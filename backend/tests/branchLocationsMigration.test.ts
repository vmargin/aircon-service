import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration('requested branch locations migration (isolated PostgreSQL)', () => {
  let db: PrismaClient;
  const organizationIds: string[] = [];
  const branchIds: string[] = [];

  beforeAll(async () => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/arctic_test') {
      throw new Error('Migration tests require the dedicated local arctic_test database.');
    }
    process.env.DATABASE_URL = url.toString();
    db = new PrismaClient();
  });

  async function runMigration() {
    const migrationPath = path.resolve(__dirname, '../prisma/migrations/20261008000000_requested_branch_locations/migration.sql');
    const migration = readFileSync(migrationPath, 'utf8');
    const statements = migration.split(/;\s*(?=UPDATE\s+"Branch")/i).map((statement) => statement.trim()).filter(Boolean);
    expect(statements).toHaveLength(5);
    for (const statement of statements) await db.$executeRawUnsafe(statement);
  }

  afterAll(async () => {
    if (db) {
      await db.branch.deleteMany({ where: { id: { in: branchIds } } });
      await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
      await db.$disconnect();
    }
  });

  it('does not block a local workspace that has no Arctic Aircon organization', async () => {
    expect(await db.organization.count({ where: { name: 'Arctic Aircon' } })).toBe(0);
    await runMigration();
  });

  it('renames the four target branches without changing IDs or other tenants', async () => {
    const fixture = randomUUID();
    const target = await db.organization.create({ data: { name: 'Arctic Aircon' } });
    const other = await db.organization.create({ data: { name: `Other tenant ${fixture}` } });
    organizationIds.push(target.id, other.id);

    const expected = [
      { oldName: 'East Branch', oldLocation: 'Tampines / Changi', name: 'Makati Branch', location: 'Makati / BGC' },
      { oldName: 'North Branch', oldLocation: 'Yishun / Woodlands', name: 'Quezon City Branch', location: 'Quezon City / Marikina' },
      { oldName: 'South Branch', oldLocation: 'Marina Bay / Sentosa', name: 'Cavite Branch', location: 'Cavite' },
      { oldName: 'West Branch', oldLocation: 'Jurong / Clementi', name: 'Bulacan Branch', location: 'Bulacan' },
    ];
    const targetBranches = await Promise.all(expected.map((branch) => db.branch.create({
      data: { name: branch.oldName, location: branch.oldLocation, organizationId: target.id },
    })));
    const otherBranch = await db.branch.create({
      data: { name: 'East Branch', location: 'Tampines / Changi', organizationId: other.id },
    });
    branchIds.push(...targetBranches.map((branch) => branch.id), otherBranch.id);

    await runMigration();

    const actual = await db.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true, location: true, organizationId: true } });
    const actualById = new Map(actual.map((branch) => [branch.id, branch]));
    expected.forEach((branch, index) => {
      expect(actualById.get(targetBranches[index].id)).toMatchObject({
        id: targetBranches[index].id,
        name: branch.name,
        location: branch.location,
        organizationId: target.id,
      });
    });
    expect(actualById.get(otherBranch.id)).toMatchObject({
      id: otherBranch.id,
      name: 'East Branch',
      location: 'Tampines / Changi',
      organizationId: other.id,
    });
  });
});
