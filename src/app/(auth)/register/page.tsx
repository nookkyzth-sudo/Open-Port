'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { register } from '@/app/auth-actions'
import { ShieldAlert, UserPlus, AlertCircle } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await register(formData)

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
          <img src="/logo.png" alt="Logo" className="w-16 h-16 mx-auto mb-3 object-contain drop-shadow-md" />
          <h1 className="text-2xl font-bold">สมัครสมาชิก</h1>
          <p className="text-slate-400 text-sm mt-1">Open Port Scanner System</p>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Username</label>
              <input
                type="text"
                name="username"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition text-slate-900 placeholder-slate-500"
                placeholder="ชื่อผู้ใช้งาน (ห้ามเว้นวรรค)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition text-slate-900 placeholder-slate-500"
                placeholder="อีเมลของคุณ"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition text-slate-900 placeholder-slate-500"
                placeholder="อย่างน้อย 6 ตัวอักษร"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 mt-6"
            >
              {loading ? 'กำลังสมัครสมาชิก...' : <><UserPlus className="w-5 h-5" /> ยืนยันการสมัคร</>}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            มีบัญชีผู้ใช้งานแล้ว? <Link href="/login" className="text-emerald-600 font-semibold hover:underline">เข้าสู่ระบบ</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
