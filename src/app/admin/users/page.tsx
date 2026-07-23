'use client'

import { useState, useEffect } from 'react'
import { ShieldAlert, UserCog, User, Key, ArrowLeft, Loader2, Save } from 'lucide-react'
import Link from 'next/link'
import { getUsers, updateUserRole, resetUserPassword } from '../actions'

type UserData = {
  id: string
  username: string
  email: string
  role: string
  createdAt: Date
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [resetModalUser, setResetModalUser] = useState<UserData | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await getUsers()
      setUsers(data)
    } catch (err: any) {
      setError('ไม่สามารถโหลดข้อมูลผู้ใช้ได้ (คุณอาจไม่มีสิทธิ์เข้าถึง)')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateUserRole(userId, newRole)
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setSuccess('เปลี่ยนสิทธิ์สำเร็จ')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleResetPassword = async () => {
    if (!resetModalUser || !newPassword) return
    if (newPassword.length < 6) {
      alert('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    setResetting(true)
    try {
      await resetUserPassword(resetModalUser.id, newPassword)
      setSuccess(`รีเซ็ตรหัสผ่านของ ${resetModalUser.username} สำเร็จ`)
      setResetModalUser(null)
      setNewPassword('')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-sky-500" />
              จัดการผู้ใช้ (Admin Panel)
            </h1>
          </div>
        </div>

        {error && <div className="mb-4 p-4 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">{error}</div>}
        {success && <div className="mb-4 p-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800">{success}</div>}

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">ผู้ใช้งาน</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">อีเมล</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">สิทธิ์การใช้งาน (Role)</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium">
                        <User className="w-4 h-4 text-slate-400" />
                        {user.username}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-sky-500 outline-none"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="EDITOR">EDITOR</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setResetModalUser(user)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50 rounded-lg transition border border-orange-200 dark:border-orange-800"
                      >
                        <Key className="w-3.5 h-3.5" /> รีเซ็ตรหัสผ่าน
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-orange-500" />
                รีเซ็ตรหัสผ่าน
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                ตั้งรหัสผ่านใหม่ให้กับผู้ใช้งาน <strong>{resetModalUser.username}</strong>
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">รหัสผ่านใหม่</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-orange-500 bg-transparent"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setResetModalUser(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting || !newPassword}
                className="px-4 py-2 text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-xl transition flex items-center gap-2 disabled:opacity-50"
              >
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกรหัสผ่านใหม่
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
