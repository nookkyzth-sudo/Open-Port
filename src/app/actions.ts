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

  try {
    await prisma.$transaction(async (tx) => {
      if (data.config) {
        await tx.config.upsert({
          where: { id: 'app-data' },
          update: { activePageId: data.config.activePageId, scanInterval: data.config.scanInterval },
          create: { id: 'app-data', activePageId: data.config.activePageId, scanInterval: data.config.scanInterval }
        })
      }

      const isSuperAdmin = currentUser.username === 'nook.cctv'
      if (Array.isArray(data.pages)) {
        const pagesToSave = data.pages.filter((p: any) => isSuperAdmin || p.userId === currentUser.userId || !p.userId)
        
        for (let i = 0; i < pagesToSave.length; i++) {
          const p = pagesToSave[i]
          const existingPage = await tx.page.findUnique({ where: { id: p.id } })
          if (existingPage && !isSuperAdmin && existingPage.userId !== currentUser.userId) continue

          const targetUserId = existingPage?.userId || p.userId || currentUser.userId
          const existingDevices = await tx.device.findMany({ where: { pageId: p.id } })
          const incomingIds = Array.isArray(p.devices) ? p.devices.map((d: any) => d.id).filter(Boolean) : []
          
          await tx.device.deleteMany({
            where: { pageId: p.id, id: { notIn: incomingIds } }
          })

          await tx.page.upsert({
            where: { id: p.id },
            update: { name: p.name, order: i },
            create: { id: p.id, name: p.name, order: i, userId: targetUserId }
          })

          if (Array.isArray(p.devices)) {
            for (let idx = 0; idx < p.devices.length; idx++) {
              const d = p.devices[idx]
              if (d.id) {
                const devExists = existingDevices.some(ed => ed.id === d.id)
                if (devExists) {
                  await tx.device.update({
                    where: { id: d.id },
                    data: { name: d.name, host: d.host, ports: d.ports, order: idx }
                  })
                } else {
                  await tx.device.create({
                    data: { name: d.name, host: d.host, ports: d.ports, order: idx, pageId: p.id, ipUpdatedAt: new Date() }
                  })
                }
              } else {
                await tx.device.create({
                  data: { name: d.name, host: d.host, ports: d.ports, order: idx, pageId: p.id, ipUpdatedAt: new Date() }
                })
              }
            }
          }
        }
      }
    }, { timeout: 30000, maxWait: 5000 })
  } catch (err: any) {
    const msg = err?.message || String(err)
    console.error('SAVE ERROR:', msg)
    return { success: false, error: msg }
  }
  
  return { success: true, error: null }
}
