import type { MembershipRole } from '@pratto/contracts';
import type { Request } from 'express';

export interface AuthenticatedPrincipal {
  sessionId: string;
  userId: string;
  rawToken: string;
  expiresAt: Date;
  renewed: boolean;
}

export interface TenantPrincipal extends AuthenticatedPrincipal {
  membershipId: string;
  organizationId: string;
  role: MembershipRole;
  establishmentIds: string[];
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthenticatedPrincipal;
  tenant?: TenantPrincipal;
}
