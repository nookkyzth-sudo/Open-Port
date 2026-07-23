'use server'

import prisma from '@/lib/prisma'
import { hashPassword, verifyPassword, createSession, verifySession } from '@/lib/auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function register(formData: FormData) {
  const username = formData.get('username') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!username || !email || !password) {
    return { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    })

    if (existingUser) {
      return { error: 'Username หรือ Email นี้มีผู้ใช้งานแล้ว' }
    }

    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: { username, email, password: hashedPassword, role: 'EDITOR' }
    })

    const { session, expires } = await createSession({ userId: user.id, username: user.username, role: user.role })
    
    // In Next.js 15, cookies() is async
    const cookieStore = await cookies()
    cookieStore.set('auth-session', session, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production' })
    
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }
  }
}

export async function login(formData: FormData) {
  const identifier = formData.get('identifier') as string // username or email
  const password = formData.get('password') as string

  if (!identifier || !password) {
    return { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }]
      }
    })

    if (!user) {
      return { error: 'ไม่พบผู้ใช้งานนี้ในระบบ' }
    }

    const isValid = await verifyPassword(password, user.password)
    if (!isValid) {
      return { error: 'รหัสผ่านไม่ถูกต้อง' }
    }
    
    // Auto upgrade nook.cctv
    let userRole = user.role
    if (user.username === 'nook.cctv' && userRole !== 'ADMIN') {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } })
      userRole = 'ADMIN'
    }

    const { session, expires } = await createSession({ userId: user.id, username: user.username, role: userRole })
    
    const cookieStore = await cookies()
    cookieStore.set('auth-session', session, { expires, httpOnly: true, secure: process.env.NODE_ENV === 'production' })
    
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }
  }
}

export async function changePassword(formData: FormData) {
  const currentPassword = formData.get('currentPassword') as string
  const newPassword = formData.get('newPassword') as string

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('auth-session')?.value
  if (!sessionCookie) return { error: 'ไม่ได้เข้าสู่ระบบ' }

  const payload = await verifySession(sessionCookie)
  if (!payload || !payload.userId) return { error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' }

  try {
    const user = await prisma.user.findUnique({ where: { id: payload.userId as string } })
    if (!user) return { error: 'ไม่พบผู้ใช้งาน' }

    const isValid = await verifyPassword(currentPassword, user.password)
    if (!isValid) return { error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }

    const hashedPassword = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })

    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }
  }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('auth-session')
  redirect('/login')
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('auth-session')?.value
  if (!sessionCookie) return null

  const payload = await verifySession(sessionCookie)
  if (!payload || !payload.userId) return null
  
  return payload as { userId: string, username: string, role: string, exp: number, iat: number }
}
