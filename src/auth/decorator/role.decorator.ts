import { SetMetadata } from '@nestjs/common';
import { Role } from 'src/enums/role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

// New decorator - exclude specific roles
export const ExceptRoles = (...excludedRoles: Role[]) => {
  const allRoles = Object.values(Role);
  const allowedRoles = allRoles.filter(role => !excludedRoles.includes(role));
  return SetMetadata(ROLES_KEY, allowedRoles);
};

// New decorator - all roles explicitly
export const AllRoles = () => SetMetadata(ROLES_KEY, Object.values(Role));