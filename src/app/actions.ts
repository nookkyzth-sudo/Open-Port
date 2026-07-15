'use server'

import prisma from '@/lib/prisma'
import { getCurrentUser } from './auth-actions'

export async function getAppData() {
  const currentUser = await getCurrentUser()
  
  // Cleanup orphaned pages
  try {
    const oldPages = await prisma.page.findMany({ where: { userId: null } })
    if (oldPages.length > 0) {
      await prisma.device.deleteMany({ where: { pageId: { in: oldPages.map(p => p.id) } } })
      await prisma.page.deleteMany({ where: { userId: null } })
    }
  } catch (e) {
    console.error('Cleanup failed', e)
  }

  const config = await prisma.config.findUnique({ where: { id: 'app-data' } })
  const pages = await prisma.page.findMany({
    include: { 
      devices: { orderBy: { order: 'asc' } },
      user: { select: { username: true } }
    },
    orderBy: { order: 'asc' }
  })

  // If the current user doesn't have a page in the DB, create one automatically
  if (currentUser) {
    const userHasPage = pages.some(p => p.userId === currentUser.userId)
    if (!userHasPage) {
      const newPage = await prisma.page.create({
        data: {
          name: `อุปกรณ์ของ ${currentUser.username}`,
          userId: currentUser.userId as string,
          devices: {
            create: [{ name: '', host: '', ports: '' }]
          }
        },
        include: {
          devices: { orderBy: { order: 'asc' } },
          user: { select: { username: true } }
        }
      })
      pages.push(newPage)
    }
  }

  return { config, pages }
}

export async function saveAppData(data: any) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Unauthorized')

  // Transaction to safely update everything
  await prisma.$transaction(async (tx) => {
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

    const isSuperAdmin = currentUser.username === 'nook.cctv'

    // Update or Insert pages
    if (Array.isArray(data.pages)) {
      // Filter pages: if superadmin, allow all. Else, only allow their own.
      const pagesToSave = data.pages.filter((p: any) => isSuperAdmin || p.userId === currentUser.userId || !p.userId)
      
      for (let i = 0; i < pagesToSave.length; i++) {
        const p = pagesToSave[i]

        const existingPage = await tx.page.findUnique({ where: { id: p.id } })
        if (existingPage && !isSuperAdmin && existingPage.userId !== currentUser.userId) {
          continue // Skip if not owner and not superadmin
        }

        const targetUserId = existingPage?.userId || p.userId || currentUser.userId

        // Delete existing devices for this page to replace them
        await tx.device.deleteMany({ where: { pageId: p.id } })
        
        await tx.page.upsert({
          where: { id: p.id },
          update: {
            name: p.name,
            order: i,
            devices: {
              create: Array.isArray(p.devices) ? p.devices.map((d: any, idx: number) => ({
                name: d.name, host: d.host, ports: d.ports, order: idx
              })) : []
            }
          },
          create: {
            id: p.id,
            name: p.name,
            order: i,
            userId: targetUserId,
            devices: {
              create: Array.isArray(p.devices) ? p.devices.map((d: any, idx: number) => ({
                name: d.name, host: d.host, ports: d.ports, order: idx
              })) : []
            }
          }
        })
      }
    }
  })
  
  return { success: true }
}
