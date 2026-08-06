export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthOrganization {
  id: string;
  name: string;
  membershipId: string;
  role: MembershipRole;
}

export interface AuthEstablishment {
  id: string;
  publicId: string;
  name: string;
  slug: string;
}

export interface AuthContextResponse {
  user: AuthUser;
  activeOrganization: AuthOrganization | null;
  organizations: AuthOrganization[];
  establishments: AuthEstablishment[];
  organizationSelectionRequired: boolean;
}

export interface CsrfResponse {
  csrfToken: string;
}

export interface AcceptedResponse {
  message: string;
}
