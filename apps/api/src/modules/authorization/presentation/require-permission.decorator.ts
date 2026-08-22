import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@pratto/contracts';

export const REQUIRED_PERMISSIONS = Symbol('required_permissions');

export const RequirePermission = (permission: Permission): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSIONS, permission);
