'use client'

import { useState } from 'react'
import { changePassword, logout } from '@/app/auth-actions'
import { ShieldAlert, KeyRound, AlertCircle, CheckCircle, ArrowLeft, LogOut } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    
    // Check if passwords match
    if (formData.get('newPassword') !== formData.get('confirmPassword')) {
      setError('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน')
      setLoading(false)
      return
    }

    const result = await changePassword(formData)

    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess('เปลี่ยนรหัสผ่านสำเร็จ')
      ;(e.target as HTMLFormElement).reset()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-bold">เปลี่ยนรหัสผ่าน</h1>
          </div>
          <Link href="/" className="text-slate-400 hover:text-white transition flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> กลับหน้าหลัก
          </Link>
        </div>
        
        <div className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg flex items-center gap-2 border border-emerald-100">
              <CheckCircle className="w-5 h-5 shrink-0" /> {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">รหัสผ่านปัจจุบัน</label>
              <input
                type="password"
                name="currentPassword"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition text-slate-900"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">รหัสผ่านใหม่</label>
              <input
                type="password"
                name="newPassword"
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">ยืนยันรหัสผ่านใหม่</label>
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 mt-6"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
