import type { MembershipRole } from './auth';

export const Permission = {
  ESTABLISHMENT_READ: 'establishment:read',
  ESTABLISHMENT_UPDATE: 'establishment:update',
  CATALOG_READ: 'catalog:read',
  CATALOG_WRITE: 'catalog:write',
  PUBLICATION_READ: 'publication:read',
  PUBLICATION_PUBLISH: 'publication:publish',
  ANALYTICS_READ: 'analytics:read',
  TEAM_READ: 'team:read',
  TEAM_INVITE: 'team:invite',
  TEAM_MANAGE: 'team:manage',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ROLE_PERMISSIONS: Record<MembershipRole, readonly Permission[]> = {
  OWNER: Object.values(Permission),
  ADMIN: [
    Permission.ESTABLISHMENT_READ,
    Permission.ESTABLISHMENT_UPDATE,
    Permission.CATALOG_READ,
    Permission.CATALOG_WRITE,
    Permission.PUBLICATION_READ,
    Permission.PUBLICATION_PUBLISH,
    Permission.ANALYTICS_READ,
    Permission.TEAM_READ,
    Permission.TEAM_INVITE,
    Permission.TEAM_MANAGE,
  ],
  MEMBER: [Permission.ESTABLISHMENT_READ, Permission.CATALOG_READ],
};

export function hasPermission(role: MembershipRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canManageRole(
  actorRole: MembershipRole,
  targetRole: MembershipRole,
  nextRole?: MembershipRole,
): boolean {
  if (actorRole === 'MEMBER') return false;
  if (actorRole === 'ADMIN' && targetRole === 'OWNER') return false;
  if (actorRole === 'ADMIN' && nextRole === 'OWNER') return false;
  return actorRole === 'OWNER' || actorRole === 'ADMIN';
}

export function assignableRoles(role: MembershipRole): readonly MembershipRole[] {
  return role === 'OWNER'
    ? ['OWNER', 'ADMIN', 'MEMBER']
    : role === 'ADMIN'
      ? ['ADMIN', 'MEMBER']
      : [];
}
