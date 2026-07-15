import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySession } from './lib/auth'

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('auth-session')?.value
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')

  if (!sessionCookie) {
    if (!isAuthPage) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  const payload = await verifySession(sessionCookie)
  
  if (!payload) {
    if (!isAuthPage) {
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('auth-session')
      return response
    }
  } else {
    if (isAuthPage) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
