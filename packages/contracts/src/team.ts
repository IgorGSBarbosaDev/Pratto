import type { MembershipRole } from './auth';

export type TeamMemberStatus = 'ACTIVE' | 'INACTIVE';
export type TeamInvitationStatus = 'PENDING' | 'ACCEPTED' | 'CANCELED' | 'EXPIRED';

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: MembershipRole;
  status: TeamMemberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: MembershipRole;
  status: TeamInvitationStatus;
  establishmentId: string;
  expiresAt: string;
  acceptedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamResponse {
  establishmentId: string;
  members: TeamMember[];
  invitations: TeamInvitation[];
}

export interface InvitationPreviewResponse {
  email: string;
  role: MembershipRole;
  establishmentName: string;
  expiresAt: string;
  accountExists: boolean;
}

export interface InvitationAcceptanceResponse {
  email: string;
  createdAccount: boolean;
  requiresLogin: true;
}
