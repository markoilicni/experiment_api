import { Role } from '@prisma/client';

export type SafeUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  managerId: string | null;
  pdpId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatedUser = SafeUser & {
  temporaryPassword: string;
};

export type TemporaryPasswordResult = {
  temporaryPassword: string;
};

export type PaginatedUsers = {
  data: SafeUser[];
  page: number;
  pageSize: number;
  total: number;
};

export function toSafeUser(user: {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  managerId: string | null;
  pdpId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SafeUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    role: user.role,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    managerId: user.managerId,
    pdpId: user.pdpId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
