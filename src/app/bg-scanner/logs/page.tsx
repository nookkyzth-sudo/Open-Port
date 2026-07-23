'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, History, Search } from 'lucide-react'
import Link from 'next/link'
import { getDeviceLogs } from '../../actions'

type DeviceLog = {
  id: string
  event: string
  message: string | null
  createdAt: Date
  device: { name: string; host: string; page: { name: string; user?: { username: string } | null } }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDeviceLogs().then(data => { setLogs(data as any); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="mb-8 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-6">
          <Link href="/bg-scanner" className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-slate-100 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <History className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Uptime History Logs
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">ประวัติการเชื่อมต่อและแจ้งเตือนอุปกรณ์ (100 รายการล่าสุด)</p>
          </div>
        </header>

        <main className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  {['เวลา (Timestamp)', 'อุปกรณ์ / IP', 'เหตุการณ์', 'รายละเอียด'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 font-mono">
                      {new Date(log.createdAt).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{log.device.name || 'ไม่ระบุชื่อ'}</p>
                      <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{log.device.host}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.event === 'OFFLINE' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> ออฟไลน์
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> กลับมาออนไลน์
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{log.message || '-'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    {loading ? 'กำลังโหลด...' : <><Search className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" /><p>ยังไม่มีประวัติการแจ้งเตือน</p></>}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
