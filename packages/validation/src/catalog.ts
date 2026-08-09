import { z } from 'zod';

export const catalogMenuIdSchema = z.string().uuid();
export const categoryIdSchema = z.string().uuid();
export const productIdSchema = z.string().uuid();

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

export const productAvailabilitySchema = z.enum(['AVAILABLE', 'TEMPORARILY_UNAVAILABLE', 'HIDDEN']);

const productNameSchema = z
  .string()
  .trim()
  .min(1, 'Informe o nome do produto.')
  .max(180, 'O nome do produto deve ter no máximo 180 caracteres.');
const productTextSchema = z
  .string()
  .trim()
  .max(2000, 'O texto deve ter no máximo 2.000 caracteres.');
const productAllergensSchema = z
  .string()
  .trim()
  .max(1000, 'Os alergênicos devem ter no máximo 1.000 caracteres.');
const productMoneySchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,8}(?:\.\d{1,2})?$/,
    'Informe um valor monetário válido com até duas casas decimais.',
  )
  .transform((value) => normalizeMoney(value));

export const productCreateSchema = z
  .object({
    categoryId: categoryIdSchema,
    name: productNameSchema,
    description: productTextSchema.optional().nullable(),
    price: productMoneySchema,
    promotionalPrice: productMoneySchema.optional().nullable(),
    ingredients: productTextSchema.optional().nullable(),
    allergens: productAllergensSchema.optional().nullable(),
    availability: productAvailabilitySchema.default('AVAILABLE'),
    featured: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.promotionalPrice && compareMoney(value.promotionalPrice, value.price) > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['promotionalPrice'],
        message: 'O preço promocional não pode ser maior que o preço normal.',
      });
    }
  });

export const productUpdateSchema = z
  .object({
    categoryId: categoryIdSchema.optional(),
    name: productNameSchema.optional(),
    description: productTextSchema.optional().nullable(),
    price: productMoneySchema.optional(),
    promotionalPrice: productMoneySchema.optional().nullable(),
    ingredients: productTextSchema.optional().nullable(),
    allergens: productAllergensSchema.optional().nullable(),
    availability: productAvailabilitySchema.optional(),
    featured: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')
  .superRefine((value, context) => {
    if (
      value.price !== undefined &&
      value.promotionalPrice !== undefined &&
      value.promotionalPrice !== null &&
      compareMoney(value.promotionalPrice, value.price) > 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['promotionalPrice'],
        message: 'O preço promocional não pode ser maior que o preço normal.',
      });
    }
  });

export const productReorderSchema = z
  .object({ productIds: z.array(productIdSchema).max(500) })
  .strict();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductReorderInput = z.infer<typeof productReorderSchema>;

function normalizeMoney(value: string): string {
  const [integer, decimals = ''] = value.split('.');
  return `${integer}.${decimals.padEnd(2, '0')}`;
}

function compareMoney(left: string, right: string): number {
  const leftCents = BigInt(left.replace('.', ''));
  const rightCents = BigInt(right.replace('.', ''));
  return leftCents === rightCents ? 0 : leftCents > rightCents ? 1 : -1;
}
