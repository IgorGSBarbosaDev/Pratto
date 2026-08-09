import { z } from 'zod';

import { categoryIdSchema } from './catalog';

export const publicMenuCursorSchema = z.string().trim().min(1).max(256);

export const publicMenuQuerySchema = z
  .object({
    cursor: publicMenuCursorSchema.optional(),
    categoryId: categoryIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(12).default(6),
  })
  .strict();

export type PublicMenuQuery = z.infer<typeof publicMenuQuerySchema>;
