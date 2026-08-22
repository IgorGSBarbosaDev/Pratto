import { z } from 'zod';

import { emailSchema, invitationTokenSchema, membershipRoleSchema, passwordSchema } from './auth';

export const teamInviteSchema = z
  .object({ email: emailSchema, role: membershipRoleSchema })
  .strict();

export const teamRoleUpdateSchema = z.object({ role: membershipRoleSchema }).strict();
export const teamMembershipIdSchema = z.string().uuid();

export const invitationPreviewSchema = z.object({ token: invitationTokenSchema }).strict();

export const invitationAcceptSchema = z
  .object({
    token: invitationTokenSchema,
    name: z.string().trim().min(1).max(120).optional(),
    password: passwordSchema.optional(),
  })
  .strict();

export type TeamInviteInput = z.infer<typeof teamInviteSchema>;
export type TeamRoleUpdateInput = z.infer<typeof teamRoleUpdateSchema>;
export type InvitationPreviewInput = z.infer<typeof invitationPreviewSchema>;
export type InvitationAcceptInput = z.infer<typeof invitationAcceptSchema>;
