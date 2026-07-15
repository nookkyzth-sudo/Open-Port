'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/app/auth-actions'
import { ShieldAlert, LogIn, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-8 text-center bg-slate-900 text-white">
          <ShieldAlert className="w-12 h-12 mx-auto text-indigo-400 mb-3" />
          <h1 className="text-2xl font-bold">เข้าสู่ระบบ</h1>
          <p className="text-slate-400 text-sm mt-1">Open Port Scanner System</p>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Username หรือ Email</label>
              <input
                type="text"
                name="identifier"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition text-slate-900 placeholder-slate-500"
                placeholder="กรอกชื่อผู้ใช้งาน หรือ อีเมล"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                name="password"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition text-slate-900 placeholder-slate-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 mt-4"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : <><LogIn className="w-5 h-5" /> เข้าสู่ระบบ</>}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            ยังไม่มีบัญชีผู้ใช้งาน? <Link href="/register" className="text-indigo-600 font-semibold hover:underline">สมัครสมาชิกที่นี่</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
