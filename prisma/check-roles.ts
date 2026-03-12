import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany();
  roles.forEach((role) => {
    console.log(`- ${role.name} (ID: ${role.id})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
