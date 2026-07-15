'use server'

import prisma from '@/lib/prisma'

export async function getAppData() {
  const config = await prisma.config.findUnique({ where: { id: 'app-data' } })
  const pages = await prisma.page.findMany({
    include: { devices: { orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' }
  })
  return { config, pages }
}

export async function saveAppData(data: any) {
  // Transaction to safely update everything
  await prisma.$transaction(async (tx) => {
    // Clear existing
    await tx.device.deleteMany({})
    await tx.page.deleteMany({})

    // Upsert config
    if (data.config) {
      await tx.config.upsert({
        where: { id: 'app-data' },
        update: {
          activePageId: data.config.activePageId,
          scanInterval: data.config.scanInterval,
        },
        create: {
          id: 'app-data',
          activePageId: data.config.activePageId,
          scanInterval: data.config.scanInterval,
        }
      })
    }

    // Insert pages and devices
    if (Array.isArray(data.pages)) {
      for (let i = 0; i < data.pages.length; i++) {
        const p = data.pages[i]
        await tx.page.create({
          data: {
            id: p.id,
            name: p.name,
            order: i,
            devices: {
              create: Array.isArray(p.devices) ? p.devices.map((d: any, idx: number) => ({
                name: d.name,
                host: d.host,
                ports: d.ports,
                order: idx
              })) : []
            }
          }
        })
      }
    }
  })
  
  return { success: true }
}
