import type { UserRole } from '../models/user';

export type DirectoryUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  phone?: string;
  company?: string;
  department?: string;
};

export type UserDirectoryFilters = {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
};

const READ_ROLES = new Set<UserRole>(['root', 'admin']);

export function normalizeRole(role?: string): UserRole {
  const knownRoles: UserRole[] = ['root', 'admin', 'vendedor', 'bodega', 'callcenter', 'soporte', 'socio', 'cliente'];
  return knownRoles.includes(role as UserRole) ? (role as UserRole) : 'cliente';
}

export function canReadUserDirectory(role?: string): boolean {
  return READ_ROLES.has(normalizeRole(role));
}

export function canMutateUsers(role?: string): boolean {
  return normalizeRole(role) === 'root';
}

export function filterUsersForDirectory(users: DirectoryUser[], filters: UserDirectoryFilters): DirectoryUser[] {
  const normalizedSearch = filters.search?.trim().toLowerCase();

  return users
    .filter((user) => {
      if (filters.role && user.role !== filters.role) {
        return false;
      }
      if (typeof filters.isActive === 'boolean' && user.isActive !== filters.isActive) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      const haystack = `${user.name} ${user.email} ${user.role}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.max(page, 1);
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const offset = (safePage - 1) * safePageSize;
  const paged = items.slice(offset, offset + safePageSize);

  return {
    items: paged,
    total: items.length,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(items.length / safePageSize))
  };
}

export function parseOptionalBoolean(raw: unknown): boolean | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}
