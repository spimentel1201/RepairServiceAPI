/**
 * Seed inicial: crea (o actualiza) el usuario ADMIN.
 *
 * Uso:
 *   1. Define en .env:  ADMIN_EMAIL, ADMIN_PASSWORD
 *   2. Ejecuta:         npm run seed
 *
 * El registro público (POST /auth/register) siempre crea TECHNICIAN,
 * así que este script es la única vía para obtener un administrador.
 */
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Faltan variables de entorno: define ADMIN_EMAIL y ADMIN_PASSWORD en .env antes de ejecutar "npm run seed".',
    );
  }

  if (password.length < 6) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 6 caracteres.');
  }

  const data = {
    email,
    password: await bcrypt.hash(password, 10),
    firstName: process.env.ADMIN_FIRST_NAME || 'Administrador',
    lastName: process.env.ADMIN_LAST_NAME || 'Sistema',
    phone: process.env.ADMIN_PHONE || '',
    profileImage: '',
    role: Role.ADMIN,
    isActive: true,
  };

  const user = await prisma.user.upsert({
    where: { email: data.email },
    update: {
      password: data.password,
      role: Role.ADMIN,
      isActive: true,
    },
    create: data,
  });

  console.log(`✔ Usuario ADMIN listo: ${user.email}`);
}

main()
  .catch((error) => {
    console.error('✖ Error ejecutando el seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
