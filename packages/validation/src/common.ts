import { z } from 'zod';

export const publicIdSchema = z.string().trim().min(1).max(64);
export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens');

export const paginationLimitSchema = z.coerce.number().int().min(1).max(100).default(20);
