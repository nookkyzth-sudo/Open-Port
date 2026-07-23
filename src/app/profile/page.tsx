'use client'

import { useState } from 'react'
import { changePassword, logout, getCurrentUser } from '@/app/auth-actions'
import { ShieldAlert, KeyRound, AlertCircle, CheckCircle, ArrowLeft, LogOut, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { getLineNotifyToken, saveLineNotifyToken } from '@/app/actions'
import { useEffect } from 'react'

export default function ProfilePage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [lineToken, setLineToken] = useState('')
  const [lineLoading, setLineLoading] = useState(false)
  const [lineMessage, setLineMessage] = useState<{type: 'error'|'success', text: string} | null>(null)

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser()
      setCurrentUser(user)
      if (user?.username === 'nook.cctv') {
        const token = await getLineNotifyToken()
        if (token) setLineToken(token)
      }
    }
    load()
  }, [])

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 bg-slate-900 dark:bg-slate-950 text-white flex justify-between items-center">
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
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded-lg flex items-center gap-2 border border-red-100 dark:border-red-800">
              <AlertCircle className="w-5 h-5 shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm rounded-lg flex items-center gap-2 border border-emerald-100 dark:border-emerald-800">
              <CheckCircle className="w-5 h-5 shrink-0" /> {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">รหัสผ่านปัจจุบัน</label>
              <input
                type="password"
                name="currentPassword"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition text-slate-900 dark:text-slate-100 placeholder-slate-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">รหัสผ่านใหม่</label>
              <input
                type="password"
                name="newPassword"
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition text-slate-900 dark:text-slate-100 placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">ยืนยันรหัสผ่านใหม่</label>
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition text-slate-900 dark:text-slate-100 placeholder-slate-400"
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

      {currentUser?.username === 'nook.cctv' && (
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden mt-6">
          <div className="p-6 bg-emerald-900 dark:bg-emerald-950 text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold">ตั้งค่าการแจ้งเตือน (LINE Notify)</h2>
          </div>
          
          <div className="p-8">
            {lineMessage && (
              <div className={`mb-6 p-3 text-sm rounded-lg flex items-center gap-2 border ${lineMessage.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-100 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800'}`}>
                {lineMessage.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
                {lineMessage.text}
              </div>
            )}
            
            <form onSubmit={async (e) => {
              e.preventDefault()
              setLineLoading(true)
              setLineMessage(null)
              try {
                await saveLineNotifyToken(lineToken)
                setLineMessage({ type: 'success', text: 'บันทึก Token สำเร็จแล้ว' })
              } catch (err: any) {
                setLineMessage({ type: 'error', text: err.message })
              }
              setLineLoading(false)
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">LINE Notify Token</label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">ออก Token ได้ที่ <a href="https://notify-bot.line.me/my/" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">notify-bot.line.me</a></p>
                <input
                  type="text"
                  value={lineToken}
                  onChange={(e) => setLineToken(e.target.value)}
                  placeholder="พิมพ์ Token ที่นี่..."
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition text-slate-900 dark:text-slate-100 placeholder-slate-400"
                />
              </div>
              <button
                type="submit"
                disabled={lineLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2 mt-6"
              >
                {lineLoading ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า LINE'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
