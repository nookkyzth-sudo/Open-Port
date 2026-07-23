'use server'

import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/app/auth-actions'
import { hashPassword } from '@/lib/auth'

export async function getUsers() {
  const currentUser = await getCurrentUser()
  if (currentUser?.role !== 'ADMIN') throw new Error('Unauthorized')

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  })
  return users
}

export async function updateUserRole(userId: string, role: string) {
  const currentUser = await getCurrentUser()
  if (currentUser?.role !== 'ADMIN') throw new Error('Unauthorized')

  if (userId === currentUser.userId) {
    throw new Error('ไม่สามารถเปลี่ยน Role ของตัวเองได้')
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role }
  })
  return { success: true }
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const currentUser = await getCurrentUser()
  if (currentUser?.role !== 'ADMIN') throw new Error('Unauthorized')

  const hashedPassword = await hashPassword(newPassword)
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword }
  })
  return { success: true }
}
