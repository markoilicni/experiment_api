import { Role } from '@prisma/client';

export type SafeUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  role: Role;
  managerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toSafeUser(user: {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  role: Role;
  managerId: string | null;
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
    managerId: user.managerId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
