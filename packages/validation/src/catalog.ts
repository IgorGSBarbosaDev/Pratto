import { z } from 'zod';

export const catalogMenuIdSchema = z.string().uuid();
export const categoryIdSchema = z.string().uuid();

const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome da categoria.')
  .max(120, 'O nome da categoria deve ter no máximo 120 caracteres.');
const categoryDescriptionSchema = z
  .string()
  .trim()
  .max(2000, 'A descrição deve ter no máximo 2.000 caracteres.');

export const categoryCreateSchema = z
  .object({
    name: categoryNameSchema,
    description: categoryDescriptionSchema.optional().nullable(),
  })
  .strict();

export const categoryUpdateSchema = z
  .object({
    name: categoryNameSchema.optional(),
    description: categoryDescriptionSchema.optional().nullable(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.');

export const categoryReorderSchema = z
  .object({ categoryIds: z.array(categoryIdSchema).max(100) })
  .strict();

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type CategoryReorderInput = z.infer<typeof categoryReorderSchema>;
