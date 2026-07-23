'use client'

import { useEffect, useState } from 'react'
import { Server, Activity, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { getBackgroundScanData } from '../actions'

const REFRESH_INTERVAL = 15 // seconds

type DeviceWithStats = {
  id: string
  name: string
  host: string
  ports: string
  bgPort1Status: string | null
  bgPort2Status: string | null
  bgLatency1: number | null
  bgLatency2: number | null
  isOffline: boolean
  bgLastScannedAt: Date | null
  page: { name: string; user?: { username: string } | null }
}

export default function BgScannerPage() {
  const [devices, setDevices] = useState<DeviceWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getBackgroundScanData()
      setDevices(data as any)
      setLastUpdated(new Date())
      setCountdown(REFRESH_INTERVAL)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const refreshInterval = setInterval(loadData, REFRESH_INTERVAL * 1000)
    const countdownInterval = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? REFRESH_INTERVAL : prev - 1))
    }, 1000)
    return () => {
      clearInterval(refreshInterval)
      clearInterval(countdownInterval)
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-6 gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 bg-white dark:bg-slate-800 rounded-full shadow hover:bg-slate-100 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="w-8 h-8 shrink-0 object-contain drop-shadow-sm" />
                Background Scanner Dashboard
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-slate-500 dark:text-slate-400 text-sm">ภาพรวมสถานะพอร์ตจากการสแกนเบื้องหลัง (อัตโนมัติ)</p>
                <Link href="/bg-scanner/logs" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline decoration-indigo-300 underline-offset-2">
                  ดูประวัติการออฟไลน์
                </Link>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Live Countdown Badge */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">LIVE · อัปเดตใน</span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums min-w-[2ch]">{countdown}s</span>
            </div>
            {lastUpdated && (
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">
                {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Server, label: 'อุปกรณ์ทั้งหมด', value: devices.length, color: 'indigo' },
              { icon: CheckCircle, label: 'ออนไลน์ (อย่างน้อย 1 พอร์ต)', value: devices.filter(d => !d.isOffline).length, color: 'emerald' },
              { icon: WifiOff, label: 'ออฟไลน์ (พอร์ตตายทั้งหมด)', value: devices.filter(d => d.isOffline).length, color: 'rose' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-${color}-50 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                  <tr>
                    {['อุปกรณ์ / IP', 'ผู้ดูแล (หน้า)', 'สถานะภาพรวม', 'Port 1', 'Port 2', 'สแกนล่าสุด'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {devices.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{d.name || 'ไม่ระบุชื่อ'}</p>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{d.host || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-md font-medium">
                          {d.page.user?.username || d.page.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {d.isOffline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span></span>
                            ออฟไลน์
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span></span>
                            ออนไลน์
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${d.bgPort1Status === 'CONNECTED' ? (d.bgLatency1 && d.bgLatency1 > 500 ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400') : d.bgPort1Status ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                          {d.bgPort1Status || '-'}{d.bgLatency1 != null && ` (${d.bgLatency1}ms)`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${d.bgPort2Status === 'CONNECTED' ? (d.bgLatency2 && d.bgLatency2 > 500 ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400') : d.bgPort2Status && d.bgPort2Status !== '-' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                          {d.bgPort2Status || '-'}{d.bgLatency2 != null && ` (${d.bgLatency2}ms)`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500 dark:text-slate-400">
                        {d.bgLastScannedAt ? new Date(d.bgLastScannedAt).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'ไม่เคยสแกน'}
                      </td>
                    </tr>
                  ))}
                  {devices.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">ไม่มีข้อมูลอุปกรณ์</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
