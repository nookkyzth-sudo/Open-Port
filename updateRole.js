const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.user.updateMany({
    where: { username: 'nook.cctv' },
    data: { role: 'ADMIN' }
  })
  console.log('Updated nook.cctv to ADMIN')
}

main().catch(console.error).finally(() => prisma.$disconnect())
