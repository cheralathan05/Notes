import { prisma } from '../src/lib/prisma';

async function main() {
  const tables = await prisma.$queryRawUnsafe<any[]>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('Tables found:', tables.map(t => t.table_name));
}

main().catch(console.error).finally(() => prisma.$disconnect());
