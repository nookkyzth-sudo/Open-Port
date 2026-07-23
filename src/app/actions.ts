'use server'

import prisma from '@/lib/prisma'
import { getCurrentUser } from './auth-actions'

export async function getAppData() {
  const currentUser = await getCurrentUser()
  
  // Cleanup orphaned pages (except TEST Port)
  try {
    const oldPages = await prisma.page.findMany({ where: { userId: null, name: { not: 'TEST Port' } } })
    if (oldPages.length > 0) {
      await prisma.device.deleteMany({ where: { pageId: { in: oldPages.map(p => p.id) } } })
      await prisma.page.deleteMany({ where: { userId: null, name: { not: 'TEST Port' } } })
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

  // Ensure TEST Port page exists
  let testPortPage = pages.find(p => p.name === 'TEST Port' && p.userId === null)
  if (!testPortPage) {
    testPortPage = await prisma.page.create({
      data: {
        name: 'TEST Port',
        userId: null,
        order: -1,
        devices: {
          create: [{ name: '', host: '', ports: '' }]
        }
      },
      include: {
        devices: { orderBy: { order: 'asc' } },
        user: { select: { username: true } }
      }
    })
    pages.unshift(testPortPage)
  }

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
  if (!currentUser || currentUser.role === 'VIEWER') throw new Error('Unauthorized')

  try {
    await prisma.$transaction(async (tx) => {
      if (data.config) {
        await tx.config.upsert({
          where: { id: 'app-data' },
          update: { activePageId: data.config.activePageId, scanInterval: data.config.scanInterval },
          create: { id: 'app-data', activePageId: data.config.activePageId, scanInterval: data.config.scanInterval }
        })
      }

      const isSuperAdmin = currentUser.role === 'ADMIN'
      if (Array.isArray(data.pages)) {
        const pagesToSave = data.pages.filter((p: any) => isSuperAdmin || p.userId === currentUser.userId || !p.userId)
        
        for (let i = 0; i < pagesToSave.length; i++) {
          const p = pagesToSave[i]
          const existingPage = await tx.page.findUnique({ where: { id: p.id } })
          if (existingPage && !isSuperAdmin && existingPage.userId !== currentUser.userId && existingPage.userId !== null) continue

          const targetUserId = existingPage ? existingPage.userId : (p.userId !== undefined ? p.userId : currentUser.userId)
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

export async function getBackgroundScanData() {
  const devices = await prisma.device.findMany({
    include: {
      page: {
        include: {
          user: { select: { username: true } }
        }
      }
    },
    orderBy: { pageId: 'asc' }
  })
  return devices
}

export async function getLineNotifyToken() {
  const currentUser = await getCurrentUser()
  if (currentUser?.role !== 'ADMIN') return null
  
  const config = await prisma.config.findUnique({ where: { id: 'app-data' } })
  return config?.lineNotifyToken || ''
}

export async function saveLineNotifyToken(token: string) {
  const currentUser = await getCurrentUser()
  if (currentUser?.role !== 'ADMIN') throw new Error('Unauthorized')
  
  await prisma.config.upsert({
    where: { id: 'app-data' },
    update: { lineNotifyToken: token },
    create: { id: 'app-data', lineNotifyToken: token }
  })
  return { success: true }
}

export async function getDeviceLogs() {
  const logs = await prisma.deviceLog.findMany({
    include: {
      device: { select: { name: true, host: true, page: { select: { name: true, user: { select: { username: true } } } } } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100 // show last 100 logs
  })
  return logs
}

export async function getDashboardData() {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Devices with their pages and users
  const devices = await prisma.device.findMany({
    where: { host: { not: '' }, ports: { not: '' } },
    include: {
      page: { include: { user: { select: { username: true } } } },
      logs: {
        where: { createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'asc' }
      },
      latencyHistory: {
        where: { createdAt: { gte: oneDayAgo } },
        orderBy: { createdAt: 'asc' },
        select: { port1Lat: true, port2Lat: true, createdAt: true }
      }
    },
    orderBy: { pageId: 'asc' }
  })

  // Calculate uptime % per device (7 days)
  // We count OFFLINE events as "downtime windows" between OFFLINE → ONLINE
  const deviceStats = devices.map(device => {
    const logs = device.logs
    const windowMs = 7 * 24 * 60 * 60 * 1000

    let downtimeMs = 0
    let lastOfflineAt: Date | null = null
    let offlineCount = 0

    for (const log of logs) {
      if (log.event === 'OFFLINE') {
        lastOfflineAt = new Date(log.createdAt)
        offlineCount++
      } else if (log.event === 'ONLINE' && lastOfflineAt) {
        downtimeMs += new Date(log.createdAt).getTime() - lastOfflineAt.getTime()
        lastOfflineAt = null
      }
    }

    // Still offline now
    if (lastOfflineAt) {
      downtimeMs += now.getTime() - lastOfflineAt.getTime()
    }

    const uptimePct = Math.max(0, Math.min(100, ((windowMs - downtimeMs) / windowMs) * 100))

    // Avg latency today
    const latHistory = device.latencyHistory
    const validLats = latHistory
      .map(h => h.port1Lat ?? h.port2Lat)
      .filter((v): v is number => v !== null && v !== undefined)
    const avgLatency = validLats.length > 0 ? Math.round(validLats.reduce((a, b) => a + b, 0) / validLats.length) : null

    return {
      id: device.id,
      name: device.name,
      host: device.host,
      ports: device.ports,
      isOffline: device.isOffline,
      bgLatency1: device.bgLatency1,
      bgLatency2: device.bgLatency2,
      bgLastScannedAt: device.bgLastScannedAt,
      owner: device.page.user?.username ?? device.page.name,
      uptimePct: Math.round(uptimePct * 10) / 10,
      downtimeMs,
      offlineCount,
      avgLatency,
      latencyHistory: latHistory.map(h => ({
        time: h.createdAt,
        port1Lat: h.port1Lat,
        port2Lat: h.port2Lat,
      }))
    }
  })

  // Summary stats
  const totalDevices = deviceStats.length
  const onlineDevices = deviceStats.filter(d => !d.isOffline).length
  const avgUptimePct = totalDevices > 0
    ? Math.round((deviceStats.reduce((a, d) => a + d.uptimePct, 0) / totalDevices) * 10) / 10
    : 0
  const totalDowntimeMs = deviceStats.reduce((a, d) => a + d.downtimeMs, 0)
  const mostOfflineDevice = [...deviceStats].sort((a, b) => b.offlineCount - a.offlineCount)[0] ?? null

  const allValidLats = deviceStats.flatMap(d => d.latencyHistory.map(h => h.port1Lat ?? h.port2Lat).filter((v): v is number => v !== null))
  const globalAvgLatency = allValidLats.length > 0
    ? Math.round(allValidLats.reduce((a, b) => a + b, 0) / allValidLats.length)
    : null

  return {
    deviceStats,
    summary: {
      totalDevices,
      onlineDevices,
      offlineDevices: totalDevices - onlineDevices,
      avgUptimePct,
      totalDowntimeMs,
      globalAvgLatency,
      mostOfflineDevice: mostOfflineDevice ? { name: mostOfflineDevice.name, count: mostOfflineDevice.offlineCount } : null,
    }
  }
}
