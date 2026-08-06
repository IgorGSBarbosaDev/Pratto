import { z } from 'zod';

function hasValidPasswordLength(value: string): boolean {
  const length = Array.from(value).length;
  return length >= 15 && length <= 128;
}

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
export const passwordSchema = z
  .string()
  .refine(hasValidPasswordLength, 'A senha deve ter entre 15 e 128 caracteres.');
export const opaqueTokenSchema = z.string().min(40).max(200);

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: opaqueTokenSchema, password: passwordSchema });
export const selectOrganizationSchema = z.object({ membershipId: z.string().uuid() });

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SelectOrganizationInput = z.infer<typeof selectOrganizationSchema>;
