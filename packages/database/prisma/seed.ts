import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { seedDatabase } from './seed-data';

const prisma = new PrismaClient();
const password = z
  .string()
  .refine((value) => Array.from(value).length >= 15 && Array.from(value).length <= 128)
  .parse(process.env.SEED_ADMIN_PASSWORD);

seedDatabase(prisma, password)
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
