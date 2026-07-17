'use client'

import { useEffect, useState } from 'react'
import { Server, Activity, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { getBackgroundScanData } from '../actions'

type DeviceWithStats = {
  id: string
  name: string
  host: string
  ports: string
  bgPort1Status: string | null
  bgPort2Status: string | null
  isOffline: boolean
  bgLastScannedAt: Date | null
  page: {
    name: string
    user?: { username: string } | null
  }
}

export default function BgScannerPage() {
  const [devices, setDevices] = useState<DeviceWithStats[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getBackgroundScanData()
      setDevices(data as any)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000) // refresh every 1 minute
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-center border-b border-slate-200 pb-6 gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 bg-white rounded-full shadow hover:bg-slate-100 transition">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
                <Activity className="w-6 h-6 text-emerald-600" />
                Background Scanner Dashboard
              </h1>
              <p className="text-slate-500 text-sm mt-1">ภาพรวมสถานะพอร์ตจากการสแกนเบื้องหลัง (อัตโนมัติ)</p>
            </div>
          </div>
          <button 
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรชข้อมูล
          </button>
        </header>

        <main className="grid grid-cols-1 gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">อุปกรณ์ทั้งหมด</p>
                <p className="text-2xl font-bold text-slate-800">{devices.length}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">ออนไลน์ (อย่างน้อย 1 พอร์ต)</p>
                <p className="text-2xl font-bold text-slate-800">{devices.filter(d => !d.isOffline).length}</p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center shrink-0">
                <WifiOff className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">ออฟไลน์ (พอร์ตตายทั้งหมด)</p>
                <p className="text-2xl font-bold text-slate-800">{devices.filter(d => d.isOffline).length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">อุปกรณ์ / IP</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">ผู้ดูแล (หน้า)</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase">สถานะภาพรวม</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase">Port 1</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase">Port 2</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">สแกนล่าสุด</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {devices.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-slate-800">{d.name || 'ไม่ระบุชื่อ'}</p>
                        <p className="text-xs font-mono text-slate-500">{d.host || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md font-medium">
                          {d.page.user?.username || d.page.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.isOffline ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5" /> ออฟไลน์
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" /> ออนไลน์
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${d.bgPort1Status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-600' : d.bgPort1Status ? 'bg-rose-50 text-rose-600' : 'text-slate-400'}`}>
                          {d.bgPort1Status || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${d.bgPort2Status === 'CONNECTED' ? 'bg-emerald-50 text-emerald-600' : d.bgPort2Status && d.bgPort2Status !== '-' ? 'bg-rose-50 text-rose-600' : 'text-slate-400'}`}>
                          {d.bgPort2Status || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        {d.bgLastScannedAt ? new Date(d.bgLastScannedAt).toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : 'ไม่เคยสแกน'}
                      </td>
                    </tr>
                  ))}
                  {devices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">ไม่มีข้อมูลอุปกรณ์</td>
                    </tr>
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
