'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Clock, History, Search } from 'lucide-react'
import Link from 'next/link'
import { getDeviceLogs } from '../../actions'

type DeviceLog = {
  id: string
  event: string
  message: string | null
  createdAt: Date
  device: {
    name: string
    host: string
    page: {
      name: string
      user?: { username: string } | null
    }
  }
}

export default function LogsPage() {
  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getDeviceLogs()
      setLogs(data as any)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-center border-b border-slate-200 pb-6 gap-4">
          <div className="flex items-center gap-3">
            <Link href="/bg-scanner" className="p-2 bg-white rounded-full shadow hover:bg-slate-100 transition">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
                <History className="w-6 h-6 text-indigo-600" />
                Uptime History Logs
              </h1>
              <p className="text-slate-500 text-sm mt-1">ประวัติการเชื่อมต่อและแจ้งเตือนอุปกรณ์ (100 รายการล่าสุด)</p>
            </div>
          </div>
        </header>

        <main className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">เวลา (Timestamp)</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">อุปกรณ์ / IP</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">เหตุการณ์</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                      {new Date(log.createdAt).toLocaleString('th-TH', { 
                        day: '2-digit', month: 'short', year: '2-digit', 
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">{log.device.name || 'ไม่ระบุชื่อ'}</p>
                      <p className="text-xs font-mono text-slate-500">{log.device.host}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.event === 'OFFLINE' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> ออฟไลน์
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> กลับมาออนไลน์
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {log.message || '-'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="w-8 h-8 text-slate-300 mb-2" />
                        <p>ยังไม่มีประวัติการแจ้งเตือน</p>
                      </div>
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
