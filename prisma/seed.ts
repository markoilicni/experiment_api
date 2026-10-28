import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('super/1234', 10);

  await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {
      passwordHash,
      temporaryPassword: null,
      mustChangePassword: false,
      name: 'Super Admin',
      email: 'superadmin@localhost',
      role: Role.SUPER,
    },
    create: {
      username: 'superadmin',
      passwordHash,
      mustChangePassword: false,
      name: 'Super Admin',
      email: 'superadmin@localhost',
      role: Role.SUPER,
    },
  });

  console.log('Seeded superadmin / super/1234 (SUPER)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
