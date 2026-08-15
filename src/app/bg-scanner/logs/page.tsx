'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, History, RefreshCw, Calendar, Download, FileText } from 'lucide-react'
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
  const [timeframe, setTimeframe] = useState<string>('100') // '100', '7d', '30d', 'all'

  useEffect(() => {
    fetchLogs(timeframe)
  }, [timeframe])

  const fetchLogs = (tf: string) => {
    setLoading(true)
    getDeviceLogs(tf)
      .then(data => { setLogs(data as any); setLoading(false) })
      .catch(() => setLoading(false))
  }

  const timeframeLabels: Record<string, string> = {
    '100': '100 รายการล่าสุด',
    '7d': '7 วันล่าสุด',
    '30d': '30 วันล่าสุด (1 เดือน)',
    'all': 'ประวัติทั้งหมด'
  }

  const exportCSV = () => {
    if (logs.length === 0) return
    const bom = '\uFEFF'
    const headers = ['#', 'เวลา (Timestamp)', 'ชื่ออุปกรณ์', 'IP Address', 'เหตุการณ์', 'รายละเอียด']
    const rows = logs.map((log, index) => {
      const timeStr = new Date(log.createdAt).toLocaleString('th-TH', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      })
      const eventLabel = log.event === 'OFFLINE' ? 'ออฟไลน์' : log.event === 'IP_CHANGED' ? 'เปลี่ยน IP' : 'ออนไลน์'
      return [
        index + 1,
        `"${timeStr}"`,
        `"${(log.device.name || 'ไม่ระบุชื่อ').replace(/"/g, '""')}"`,
        `"${(log.device.host || '-').replace(/"/g, '""')}"`,
        `"${eventLabel}"`,
        `"${(log.message || '-').replace(/"/g, '""')}"`
      ]
    })

    const csvContent = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `uptime_logs_report_${timeframe}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportTXT = () => {
    if (logs.length === 0) return
    let content = `=== รายงาน Uptime History Logs (${timeframeLabels[timeframe]}) ===\n`
    content += `วันที่ออกรายงาน: ${new Date().toLocaleString('th-TH')}\n`
    content += `จำนวนรายการ: ${logs.length} รายการ\n`
    content += `--------------------------------------------------------------------------------\n\n`

    logs.forEach((log, index) => {
      const timeStr = new Date(log.createdAt).toLocaleString('th-TH', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
      const eventLabel = log.event === 'OFFLINE' ? '[ออฟไลน์]' : log.event === 'IP_CHANGED' ? '[เปลี่ยน IP]' : '[ออนไลน์]'
      content += `${index + 1}. เวลา: ${timeStr}\n`
      content += `   อุปกรณ์: ${log.device.name || 'ไม่ระบุชื่อ'} (${log.device.host})\n`
      content += `   สถานะ: ${eventLabel}\n`
      content += `   รายละเอียด: ${log.message || '-'}\n\n`
    })

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `uptime_logs_report_${timeframe}_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const totalOfflineCount = logs.filter(l => l.event === 'OFFLINE').length
  const totalOnlineCount = logs.filter(l => l.event === 'ONLINE').length
  const totalIpChangeCount = logs.filter(l => l.event === 'IP_CHANGED').length

  // Calculate counts per device name
  const offlineCountsByName: Record<string, number> = {}
  const ipChangeCountsByName: Record<string, number> = {}

  logs.forEach(l => {
    const devName = l.device.name || 'ไม่ระบุชื่อ'
    if (l.event === 'OFFLINE') {
      offlineCountsByName[devName] = (offlineCountsByName[devName] || 0) + 1
    } else if (l.event === 'IP_CHANGED') {
      ipChangeCountsByName[devName] = (ipChangeCountsByName[devName] || 0) + 1
    }
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
          <div className="flex items-center gap-3">
            <Link href="/bg-scanner" className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-slate-100 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <History className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                Uptime History Logs
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                ประวัติการเชื่อมต่อและแจ้งเตือนอุปกรณ์ ({timeframeLabels[timeframe]})
              </p>
            </div>
          </div>

          {/* Timeframe Filter Controls & Export Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">ช่วงเวลา:</span>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="bg-slate-50 dark:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 rounded-lg px-2.5 py-1 outline-none border border-slate-200 dark:border-slate-600 cursor-pointer"
              >
                <option value="100">100 รายการล่าสุด</option>
                <option value="7d">7 วันล่าสุด</option>
                <option value="30d">30 วันล่าสุด (1 เดือน)</option>
                <option value="all">ประวัติทั้งหมด</option>
              </select>
            </div>

            <button
              onClick={() => fetchLogs(timeframe)}
              disabled={loading}
              className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-xl transition border border-indigo-100 dark:border-indigo-800"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Export Buttons */}
            <div className="flex items-center gap-1.5 ml-1">
              <button
                onClick={exportCSV}
                disabled={logs.length === 0}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl transition border border-emerald-200 dark:border-emerald-800 shadow-sm disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> Report (.csv)
              </button>
              <button
                onClick={exportTXT}
                disabled={logs.length === 0}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition border border-slate-200 dark:border-slate-600 shadow-sm disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5" /> Report (.txt)
              </button>
            </div>
          </div>
        </header>

        {/* Summary Chips by Event & Name */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">ออฟไลน์รวม</p>
              <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">{totalOfflineCount} ครั้ง</p>
            </div>
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">ออนไลน์รวม</p>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{totalOnlineCount} ครั้ง</p>
            </div>
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">เปลี่ยน IP อัตโนมัติรวม</p>
              <p className="text-xl font-extrabold text-sky-600 dark:text-sky-400 mt-0.5">{totalIpChangeCount} ครั้ง</p>
            </div>
            <span className="w-3 h-3 rounded-full bg-sky-500"></span>
          </div>
        </div>

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
                      ) : log.event === 'IP_CHANGED' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span> เปลี่ยน IP
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> กลับมาออนไลน์
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {log.message || '-'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                      {loading ? 'กำลังโหลดข้อมูล...' : 'ยังไม่มีประวัติการแจ้งเตือนในช่วงเวลานี้'}
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
