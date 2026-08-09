import { z } from 'zod';

const nullableText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullable(),
  );

const contactSchema = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') return value;
      const normalized = value.trim();
      return normalized === '' ? null : normalized;
    },
    z
      .string()
      .min(8)
      .max(30)
      .regex(/^[0-9+()\-\s]+$/, 'Use apenas números e caracteres de telefone válidos.')
      .nullable(),
  );

const addressText = (max: number) => z.string().trim().max(max);

export const establishmentAddressSchema = z
  .object({
    street: addressText(160).min(1),
    number: addressText(20),
    complement: addressText(120),
    neighborhood: addressText(120).min(1),
    city: addressText(120).min(1),
    state: addressText(80).min(2),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{5}-?\d{3}$/, 'Informe um CEP válido.'),
  })
  .strict();

const nullableAddressSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return value;
  const fields = Object.values(value as Record<string, unknown>);
  return fields.length > 0 && fields.every((field) => field === '' || field === null)
    ? null
    : value;
}, establishmentAddressSchema.nullable());

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe um horário válido.');
const dayHoursSchema = z
  .object({ closed: z.boolean(), open: timeSchema, close: timeSchema })
  .strict();

export const establishmentOperatingHoursSchema = z
  .object({
    monday: dayHoursSchema,
    tuesday: dayHoursSchema,
    wednesday: dayHoursSchema,
    thursday: dayHoursSchema,
    friday: dayHoursSchema,
    saturday: dayHoursSchema,
    sunday: dayHoursSchema,
  })
  .strict();

export const establishmentThemeSchema = z
  .object({
    mode: z.enum(['LIGHT', 'DARK']),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Informe uma cor hexadecimal válida.'),
  })
  .strict();

export const establishmentIdSchema = z.string().uuid();
export const establishmentAssetKindSchema = z.enum(['logo', 'cover']);

export const establishmentUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens')
      .optional(),
    description: nullableText(2_000).optional(),
    phone: contactSchema().optional(),
    whatsapp: contactSchema().optional(),
    address: nullableAddressSchema.optional(),
    operatingHours: establishmentOperatingHoursSchema.optional(),
    theme: establishmentThemeSchema.optional(),
  })
  .strict();

export const DEFAULT_ESTABLISHMENT_OPERATING_HOURS = {
  monday: { closed: false, open: '08:00', close: '18:00' },
  tuesday: { closed: false, open: '08:00', close: '18:00' },
  wednesday: { closed: false, open: '08:00', close: '18:00' },
  thursday: { closed: false, open: '08:00', close: '18:00' },
  friday: { closed: false, open: '08:00', close: '18:00' },
  saturday: { closed: true, open: '08:00', close: '18:00' },
  sunday: { closed: true, open: '08:00', close: '18:00' },
};

export const DEFAULT_ESTABLISHMENT_THEME = {
  mode: 'LIGHT' as const,
  primaryColor: '#166534',
};

export type EstablishmentAddressInput = z.infer<typeof establishmentAddressSchema>;
export type EstablishmentOperatingHoursInput = z.infer<typeof establishmentOperatingHoursSchema>;
export type EstablishmentThemeInput = z.infer<typeof establishmentThemeSchema>;
export type EstablishmentUpdateInput = z.infer<typeof establishmentUpdateSchema>;
