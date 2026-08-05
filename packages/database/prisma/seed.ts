import { PrismaClient } from '@prisma/client';

import { seedDatabase } from './seed-data';

const prisma = new PrismaClient();

seedDatabase(prisma)
  .then(() => {
    console.info('Database seed completed.');
  })
  .catch((error: unknown) => {
    console.error('Database seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
