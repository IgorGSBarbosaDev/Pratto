import type {
  InvitationAcceptanceResponse,
  InvitationPreviewResponse,
  MembershipRole,
  TeamInvitation,
  TeamResponse,
  TeamMember,
} from '@pratto/contracts';

import { request } from '../auth/api-client';

export const teamApi = {
  get: (establishmentId: string) =>
    request<TeamResponse>(`/admin/establishments/${establishmentId}/team`),
  invite: (establishmentId: string, input: { email: string; role: MembershipRole }) =>
    request<TeamInvitation>(`/admin/establishments/${establishmentId}/team/invitations`, {
      method: 'POST',
      body: JSON.stringify(input),
      csrf: true,
    }),
  resend: (establishmentId: string, invitationId: string) =>
    request<TeamInvitation>(
      `/admin/establishments/${establishmentId}/team/invitations/${invitationId}/resend`,
      { method: 'POST', csrf: true },
    ),
  cancel: (establishmentId: string, invitationId: string) =>
    request<void>(`/admin/establishments/${establishmentId}/team/invitations/${invitationId}`, {
      method: 'DELETE',
      csrf: true,
    }),
  updateRole: (establishmentId: string, membershipId: string, role: MembershipRole) =>
    request<TeamMember>(`/admin/establishments/${establishmentId}/team/members/${membershipId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
      csrf: true,
    }),
  remove: (establishmentId: string, membershipId: string) =>
    request<void>(`/admin/establishments/${establishmentId}/team/members/${membershipId}`, {
      method: 'DELETE',
      csrf: true,
    }),
  previewInvitation: (token: string) =>
    request<InvitationPreviewResponse>('/invitations/preview', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  acceptInvitation: (input: { token: string; name?: string; password?: string }) =>
    request<InvitationAcceptanceResponse>('/invitations/accept', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
