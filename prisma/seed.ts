import { PrismaClient } from '@prisma/client';
import { Role } from '../src/enums/role.enum';

const prisma = new PrismaClient();

async function seedRoles() {
  const roleNames = Object.values(Role);

  for (const name of roleNames) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('Roles seeded successfully.');
}

async function main() {
  try {
    await seedRoles();
  } catch (error) {
    console.error('Error seeding roles:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());