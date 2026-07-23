'use client'

import { useState, useEffect, useRef } from 'react'
import { getDashboardData } from '../actions'
import Link from 'next/link'
import {
  ArrowLeft, Server, Activity, AlertTriangle,
  Clock, TrendingUp, Zap, BarChart2, RefreshCw
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'
import jsPDF from 'jspdf'
import * as htmlToImage from 'html-to-image'

type DeviceStat = {
  id: string
  name: string
  host: string
  ports: string
  isOffline: boolean
  bgLatency1: number | null
  bgLatency2: number | null
  bgLastScannedAt: Date | null
  owner: string
  uptimePct: number
  downtimeMs: number
  offlineCount: number
  avgLatency: number | null
  latencyHistory: { time: Date; port1Lat: number | null; port2Lat: number | null }[]
}

type Summary = {
  totalDevices: number
  onlineDevices: number
  offlineDevices: number
  avgUptimePct: number
  totalDowntimeMs: number
  globalAvgLatency: number | null
  mostOfflineDevice: { name: string; count: number } | null
}

function formatDuration(ms: number) {
  if (ms < 60000) return `${Math.round(ms / 1000)} วิ`
  if (ms < 3600000) return `${Math.round(ms / 60000)} นาที`
  const h = Math.floor(ms / 3600000)
  const m = Math.round((ms % 3600000) / 60000)
  return m > 0 ? `${h}ชม. ${m}นาที` : `${h} ชม.`
}

function UptimeBar({ pct, isOffline }: { pct: number; isOffline: boolean }) {
  const color = isOffline ? '#f43f5e' : pct >= 99 ? '#10b981' : pct >= 95 ? '#f59e0b' : '#f43f5e'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-slate-700/50 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold w-14 text-right shrink-0" style={{ color }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-bold">
            {p.name}: {p.value != null ? `${p.value} ms` : '-'}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const [deviceStats, setDeviceStats] = useState<DeviceStat[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'uptime' | 'offline' | 'latency'>('uptime')
  const [exportingPDF, setExportingPDF] = useState(false)
  
  const dashboardRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getDashboardData()
      setDeviceStats(data.deviceStats as any)
      setSummary(data.summary)
      if (!selectedDeviceId && data.deviceStats.length > 0) {
        setSelectedDeviceId(data.deviceStats[0].id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const selectedDevice = deviceStats.find(d => d.id === selectedDeviceId)

  const chartData = (selectedDevice?.latencyHistory ?? []).map(h => ({
    time: new Date(h.time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    'Port 1': h.port1Lat ?? null,
    'Port 2': h.port2Lat ?? null,
  }))

  const sortedDevices = [...deviceStats].sort((a, b) => {
    if (sortBy === 'uptime') return a.uptimePct - b.uptimePct
    if (sortBy === 'offline') return b.offlineCount - a.offlineCount
    if (sortBy === 'latency') return (b.avgLatency ?? 0) - (a.avgLatency ?? 0)
    return 0
  })

  const exportCSV = () => {
    // Add BOM for Excel UTF-8 support
    const bom = '\uFEFF'
    const headers = ['ชื่ออุปกรณ์', 'Host', 'เจ้าของ', 'Uptime (%)', 'Avg Latency (ms)', 'จำนวน Offline', 'Downtime']
    const rows = sortedDevices.map(d => [
      `"${d.name || ''}"`,
      d.host,
      `"${d.owner}"`,
      d.uptimePct.toFixed(1),
      d.avgLatency != null ? d.avgLatency : 'N/A',
      d.offlineCount,
      formatDuration(d.downtimeMs)
    ])
    
    const csvContent = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `openport_report_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportPDF = async () => {
    if (!dashboardRef.current) return
    setExportingPDF(true)
    try {
      const dataUrl = await htmlToImage.toJpeg(dashboardRef.current, { 
        quality: 0.95,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#020617' : '#f8fafc',
        pixelRatio: 2
      })
      
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgProps = pdf.getImageProperties(dataUrl)
      
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`openport_dashboard_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err) {
      console.error('Error generating PDF:', err)
      alert('เกิดข้อผิดพลาดในการสร้าง PDF')
    } finally {
      setExportingPDF(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans" ref={dashboardRef}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700">
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                Analytics Dashboard
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">สถิติ Uptime &amp; Latency — ย้อนหลัง 7 วัน / 24 ชม.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={exportCSV}
              disabled={loading || deviceStats.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-800 border border-emerald-200 dark:border-emerald-700 rounded-lg text-sm font-medium transition disabled:opacity-50 text-emerald-700 dark:text-emerald-400 shadow-sm"
            >
              CSV
            </button>
            <button
              onClick={exportPDF}
              disabled={loading || exportingPDF || summary == null}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-800 border border-rose-200 dark:border-rose-700 rounded-lg text-sm font-medium transition disabled:opacity-50 text-rose-700 dark:text-rose-400 shadow-sm"
            >
              {exportingPDF ? 'กำลังสร้าง...' : 'PDF'}
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium transition disabled:opacity-50 text-slate-700 dark:text-slate-200 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </button>
          </div>
        </header>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Server className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">อุปกรณ์ทั้งหมด</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.totalDevices}</p>
                <p className="text-xs text-slate-500">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{summary.onlineDevices} ออนไลน์</span>
                  {' / '}
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">{summary.offlineDevices} ออฟไลน์</span>
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">Avg Uptime (7 วัน)</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.avgUptimePct}%</p>
                <p className="text-xs text-slate-500">ค่าเฉลี่ยทุกอุปกรณ์</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">Avg Latency วันนี้</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {summary.globalAvgLatency != null ? `${summary.globalAvgLatency} ms` : 'N/A'}
                </p>
                <p className="text-xs text-slate-500">ค่าเฉลี่ยทุกพอร์ต</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-500/10 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">Offline บ่อยที่สุด</p>
                <p className="text-base font-bold text-rose-600 dark:text-rose-400 truncate max-w-[120px]">
                  {summary.mostOfflineDevice ? summary.mostOfflineDevice.name : 'ไม่มีข้อมูล'}
                </p>
                {summary.mostOfflineDevice && (
                  <p className="text-xs text-slate-500">{summary.mostOfflineDevice.count} ครั้ง (7 วัน)</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Uptime Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Uptime รายอุปกรณ์ (7 วัน)
              </h2>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="uptime">เรียงตาม Uptime (น้อย→มาก)</option>
                <option value="offline">เรียงตาม Offline บ่อย</option>
                <option value="latency">เรียงตาม Latency สูง</option>
              </select>
            </div>
            <div className="overflow-y-auto max-h-[420px]">
              {loading ? (
                <div className="p-8 text-center text-slate-500">กำลังโหลด...</div>
              ) : sortedDevices.length === 0 ? (
                <div className="p-8 text-center text-slate-500">ไม่มีข้อมูลอุปกรณ์</div>
              ) : (
                <table className="min-w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase">อุปกรณ์</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase">User</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase">Uptime %</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase">Latency</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase">Offline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedDevices.map(d => (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedDeviceId(d.id)}
                        className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${selectedDeviceId === d.id ? 'bg-indigo-50 dark:bg-indigo-950/60 border-l-4 border-indigo-500' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${d.isOffline ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[110px]">{d.name || 'ไม่ระบุ'}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{d.host}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[90px]">
                            <svg className="w-2.5 h-2.5 text-indigo-500 dark:text-indigo-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                            {d.owner}
                          </span>
                        </td>
                        <td className="px-4 py-3 min-w-[130px]">
                          <UptimeBar pct={d.uptimePct} isOffline={d.isOffline} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                            {d.avgLatency != null ? `${d.avgLatency} ms` : '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-bold ${d.offlineCount > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-600'}`}>
                            {d.offlineCount > 0 ? `${d.offlineCount}x` : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Latency Chart */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Latency Timeline (24 ชม.)
                  </h2>
                  {selectedDevice && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedDevice.name} — {selectedDevice.host}
                    </p>
                  )}
                </div>
                <select
                  value={selectedDeviceId ?? ''}
                  onChange={e => setSelectedDeviceId(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 max-w-[160px]"
                >
                  {deviceStats.map(d => (
                    <option key={d.id} value={d.id}>{d.name || d.host}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 p-4">
              {loading ? (
                <div className="h-64 flex items-center justify-center text-slate-500">กำลังโหลด...</div>
              ) : chartData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-2">
                  <Clock className="w-8 h-8 opacity-40" />
                  <p className="text-sm">ยังไม่มีข้อมูล Latency History</p>
                  <p className="text-xs text-slate-600">ข้อมูลจะปรากฏหลัง Background Scan ทำงาน</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#1e293b' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `${v}ms`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                    <ReferenceLine y={300} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Slow (300ms)', fill: '#f59e0b', fontSize: 9 }} />
                    <Line
                      type="monotone"
                      dataKey="Port 1"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#6366f1' }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Port 2"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#22d3ee' }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Device Detail Cards */}
            {selectedDevice && (
              <div className="px-5 pb-5 grid grid-cols-3 gap-3 mt-4">
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-700/50">
                  <p className="text-[10px] text-slate-500 mb-1">สถานะปัจจุบัน</p>
                  <p className={`text-sm font-bold ${selectedDevice.isOffline ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {selectedDevice.isOffline ? '🔴 Offline' : '🟢 Online'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-700/50">
                  <p className="text-[10px] text-slate-500 mb-1">Latency ล่าสุด</p>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {selectedDevice.bgLatency1 != null ? `${selectedDevice.bgLatency1} ms` : 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-700/50">
                  <p className="text-[10px] text-slate-500 mb-1">Downtime 7 วัน</p>
                  <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                    {selectedDevice.downtimeMs > 0 ? formatDuration(selectedDevice.downtimeMs) : '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-slate-600">
          ข้อมูล Latency จะสะสมขึ้นเรื่อยๆ ทุกครั้งที่ Background Scanner ทำงาน • ข้อมูลเก่ากว่า 7 วันจะถูกลบอัตโนมัติ
        </div>

      </div>
    </div>
  )
}
