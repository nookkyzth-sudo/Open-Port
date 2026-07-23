'use client'

import { useState, useEffect, useRef } from 'react'
import { ShieldAlert, Radio, Server, Database, Timer, Save, ListPlus, Info, PlusCircle, Clock, Plus, RotateCcw, PlayCircle, TableProperties, FileText, X, ChevronLeft, ChevronRight, Edit2, Trash2, AlertCircle, CheckCircle, User, LogOut, Activity, AlertTriangle, BarChart2 } from 'lucide-react'
import { getAppData, saveAppData, getBackgroundScanData } from './actions'
import { getCurrentUser, logout } from './auth-actions'
import Link from 'next/link'

type Device = { id?: string, name: string, host: string, ports: string, ipUpdatedAt?: string | Date | null, isOffline?: boolean }
type Page = { id: string, name: string, userId?: string | null, user?: { username: string } | null, devices: Device[] }
type Config = { activePageId: string | null, scanInterval: string | null }
type ScanResult = { id: number, name: string, host: string, results: { port: number, status: string, latency?: number | null }[] }

export default function Home() {
  const [pages, setPages] = useState<Page[]>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [config, setConfig] = useState<Config>({ activePageId: null, scanInterval: 'off' })
  const [isConnected, setIsConnected] = useState(false) // For API status
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [scanProgress, setScanProgress] = useState(0)
  const [totalTargets, setTotalTargets] = useState(0)
  const [finishedCount, setFinishedCount] = useState(0)
  
  const [alert, setAlert] = useState<{ type: 'error'|'success'|'info', message: string } | null>(null)
  
  const [liveOfflineStatuses, setLiveOfflineStatuses] = useState<Record<string, boolean>>({})

  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const timeLeftRef = useRef<number | null>(null)
  const startScanRef = useRef<() => void>(() => {})

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    loadData()
    
    // Auto-refresh offline status every 30 seconds
    const fetchOffline = async () => {
      try {
        const data = await getBackgroundScanData()
        const statusMap: Record<string, boolean> = {}
        data.forEach((d: any) => {
          statusMap[d.id] = d.isOffline
        })
        setLiveOfflineStatuses(statusMap)
      } catch (e) {}
    }
    
    fetchOffline()
    const offlineIntv = setInterval(fetchOffline, 30000)
    return () => clearInterval(offlineIntv)
  }, [])

  useEffect(() => {
    startScanRef.current = startScan
  }, [pages, activePageId]) // depend on state that startScan uses

  useEffect(() => {
    timeLeftRef.current = timeLeft
  }, [timeLeft])

  useEffect(() => {
    if (config.scanInterval && config.scanInterval !== 'off') {
      const minutes = parseInt(config.scanInterval)
      if (!isNaN(minutes) && minutes > 0) {
        setTimeLeft(minutes * 60)
      } else {
        setTimeLeft(null)
      }
    } else {
      setTimeLeft(null)
    }
  }, [config.scanInterval])

  useEffect(() => {
    const timer = setInterval(() => {
      if (timeLeftRef.current !== null && timeLeftRef.current > 0) {
        setTimeLeft(prev => prev !== null ? prev - 1 : null)
      } else if (timeLeftRef.current === 0) {
        startScanRef.current()
        const minutes = parseInt(config.scanInterval || 'off')
        if (!isNaN(minutes) && minutes > 0) {
          setTimeLeft(minutes * 60)
        } else {
          setTimeLeft(null)
        }
      }
    }, 1000)
    
    return () => clearInterval(timer)
  }, [config.scanInterval])

  const loadData = async () => {
    try {
      const [data, user] = await Promise.all([getAppData(), getCurrentUser()])
      setCurrentUser(user)
      setPages(data.pages)
      const myPage = user ? data.pages.find((p: Page) => p.userId === user.userId) : null
      setActivePageId(myPage ? myPage.id : (data.pages[0]?.id || null))
      setIsConnected(true)
    } catch (err) {
      setIsConnected(false)
      setAlert({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' })
    }
  }

  const handleSave = async () => {
    try {
      const isSuperAdmin = currentUser?.username === 'nook.cctv'
      const pagesToSave = pages.filter(p => isSuperAdmin ? true : (p.userId === currentUser?.userId || !p.userId))
      const result = await saveAppData({ pages: pagesToSave, config: { ...config, activePageId } })
      if (result?.error) {
        setAlert({ type: 'error', message: `Error: ${result.error}` })
      } else {
        setAlert({ type: 'success', message: 'บันทึกข้อมูลเรียบร้อยแล้ว ✓' })
        setTimeout(() => setAlert(null), 5000)
        // Reload data to refresh ipUpdatedAt timestamps
        const freshData = await getAppData()
        setPages(freshData.pages as Page[])
      }
    } catch (err: any) {
      const msg = err?.message || String(err)
      setAlert({ type: 'error', message: `Error: ${msg}` })
    }
  }


  const handleDeviceChange = (pageId: string, devIndex: number, field: keyof Device, value: string) => {
    setPages(prev => prev.map(p => {
      if (p.id !== pageId) return p
      const newDevices = [...p.devices]
      newDevices[devIndex] = { ...newDevices[devIndex], [field]: value }
      return { ...p, devices: newDevices }
    }))
  }

  const addDevice = (pageId: string) => {
    setPages(pages.map(p => {
      if (p.id === pageId) {
        return { ...p, devices: [...p.devices, { name: '', host: '', ports: '' }] }
      }
      return p
    }))
  }

  const removeDevice = (devIndex: number) => {
    setPages(prev => prev.map(p => {
      if (p.id !== activePageId) return p
      const newDevices = p.devices.filter((_, i) => i !== devIndex)
      if (newDevices.length === 0) newDevices.push({ name: '', host: '', ports: '' })
      return { ...p, devices: newDevices }
    }))
  }

  const activePage = pages.find(p => p.id === activePageId)
  const isSuperAdmin = currentUser?.role === 'ADMIN'
  const isViewer = currentUser?.role === 'VIEWER'
  const canEditActivePage = !isViewer && (activePage?.userId === currentUser?.userId || isSuperAdmin || !activePage?.userId)

  const offlineDevices = pages.flatMap(p => 
    p.devices.map(d => {
      const isLiveOffline = (d.id && liveOfflineStatuses[d.id] !== undefined) ? liveOfflineStatuses[d.id] : d.isOffline
      return { ...d, isOffline: isLiveOffline, pageName: p.name, userName: p.user?.username }
    })
  ).filter(d => d.isOffline && d.host && d.ports)

  const exportToTxt = () => {
    if (!activePage) return
    let content = ''
    const validDevices = activePage.devices.filter(d => d.name || d.host)
    validDevices.forEach((dev, index) => {
      const ports = dev.ports.split(',').map(p => p.trim())
      const port1 = ports[0] || '-'
      const port2 = ports[1] || '-'
      content += `${dev.name || 'Unknown'}\n`
      content += `${dev.host || 'Unknown'}\tPort1: ${port1} Port2: ${port2}\n`
      if (index < validDevices.length - 1) content += '\n'
    })
    
    const d = new Date()
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${(d.getFullYear() + 543).toString().slice(-2)}`
    if (content.length > 0) content += '\n'
    content += `(True ไอพีจริง ค.กลางวัน + ค.กลางคืน วันที่ ${dateStr})`
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activePage.user?.username || activePage.name}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const startScan = async () => {
    if (!activePage) return
    
    // Validation
    const targetsToScan: any[] = []
    for (let i = 0; i < activePage.devices.length; i++) {
      const dev = activePage.devices[i]
      if (!dev.name || !dev.host || !dev.ports) {
        return setAlert({ type: 'error', message: `แถวที่ ${i+1} กรอกข้อมูลไม่สมบูรณ์` })
      }
      const ports = dev.ports.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0 && p <= 65535)
      if (ports.length === 0 || ports.length > 2) {
        return setAlert({ type: 'error', message: `แถวที่ ${i+1} พอร์ตไม่ถูกต้อง (1-2 พอร์ตเท่านั้น)` })
      }
      targetsToScan.push({ name: dev.name, host: dev.host, ports })
    }

    setAlert(null)
    setScanning(true)
    setScanResults([])
    setTotalTargets(targetsToScan.length)
    setFinishedCount(0)
    setScanProgress(0)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: targetsToScan })
      })

      if (!res.body) throw new Error('No readable stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          if (event.startsWith('event: scan-item-result')) {
            const dataStr = event.split('\ndata: ')[1]
            if (dataStr) {
              const data = JSON.parse(dataStr)
              setScanResults(prev => [...prev, data])
              setFinishedCount(prev => {
                const next = prev + 1
                setScanProgress(Math.round((next / targetsToScan.length) * 100))
                return next
              })
            }
          }
        }
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'การสแกนล้มเหลว' })
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="mb-8 flex flex-col xl:flex-row justify-between items-center xl:items-end gap-6 border-b border-slate-200 dark:border-slate-700 pb-6 text-center xl:text-left">
          <div className="flex flex-col items-center xl:items-start">
            <h1 className="text-3xl font-extrabold text-indigo-700 flex flex-wrap items-center justify-center xl:justify-start gap-2.5">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 shrink-0 object-contain drop-shadow-md" />
                <span>Open Port Scanner</span>
              </div>
              <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 px-2.5 py-1 rounded-full whitespace-nowrap tracking-wide">
                REAL-TIME (Vercel)
              </span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">เครื่องมือตรวจสอบความปลอดภัยพอร์ตแบบกลุ่ม (สำหรับ Public IP)</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto justify-center">
            {/* Status & Manual */}
            <div className="flex flex-wrap justify-center items-center gap-2">
              <a href="/IP-Manual.html" target="_blank" className="text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition shadow-sm border border-blue-100 dark:border-blue-800">
                <FileText className="w-4 h-4" /> คู่มือตั้งค่าสาขา
              </a>
              <Link href="/monitor" className="text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition shadow-sm border border-purple-100 dark:border-purple-800">
                <Timer className="w-4 h-4" /> เครื่องมือทดสอบ
              </Link>
              <Link href="/dashboard" className="text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition shadow-sm border border-amber-100 dark:border-amber-800">
                <BarChart2 className="w-4 h-4" /> Dashboard
              </Link>
              <Link href="/network-map" className="text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition shadow-sm border border-sky-100 dark:border-sky-800">
                <Activity className="w-4 h-4" /> Network Map
              </Link>
              <span className={`text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 shadow-sm border ${isConnected ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800'}`}>
                <Database className="w-4 h-4" /> {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {/* User Actions */}
            {currentUser && (
              <div className="flex flex-wrap justify-center items-center gap-2 sm:border-l-2 sm:border-slate-200 dark:sm:border-slate-700 sm:pl-3 pt-3 sm:pt-0 border-t-2 sm:border-t-0 border-slate-100 dark:border-slate-700 w-full sm:w-auto mt-2 sm:mt-0">
                {currentUser.role === 'ADMIN' && (
                  <Link href="/admin/users" className="text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition shadow-sm border border-sky-100 dark:border-sky-800">
                    <ShieldAlert className="w-4 h-4" /> จัดการผู้ใช้
                  </Link>
                )}
                <Link href="/bg-scanner" className="text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition shadow-sm border border-indigo-100 dark:border-indigo-800">
                  <Activity className="w-4 h-4" /> ระบบหลังบ้าน
                </Link>
                <Link href="/profile" className="text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition shadow-sm border border-slate-200 dark:border-slate-600">
                  <User className="w-4 h-4" /> {currentUser.username}
                </Link>
                <button onClick={() => logout()} className="text-xs font-bold px-3.5 py-2 rounded-full flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition shadow-sm border border-rose-100 dark:border-rose-800">
                  <LogOut className="w-4 h-4" /> ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </header>



        {offlineDevices.length > 0 && (
          <div className="mb-6 p-4 rounded-xl flex flex-col gap-2 border bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 shadow-sm animate-pulse">
            <div className="flex items-center gap-2 font-bold text-rose-900 dark:text-rose-300">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              แจ้งเตือน: พบอุปกรณ์ไม่สามารถเชื่อมต่อได้ (ออฟไลน์)
            </div>
            <ul className="text-sm font-medium pl-7 list-disc">
              {offlineDevices.map((d, idx) => (
                <li key={idx}>
                  อุปกรณ์ <strong>{d.name || 'ไม่ระบุชื่อ'}</strong> ({d.host}) ของผู้ใช้ <strong>{d.userName || d.pageName}</strong> ไม่สามารถเชื่อมต่อพอร์ตใดๆ ได้เลย
                </li>
              ))}
            </ul>
          </div>
        )}

        <main className="grid grid-cols-1 gap-8">
          <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 bg-slate-900 dark:bg-slate-950 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold">กำหนดค่าอุปกรณ์และพอร์ตที่ต้องการสแกน</h2>
              </div>
              <span className="bg-indigo-600 text-white text-xs font-semibold px-2.5 py-1 rounded">
                {activePage?.devices.length || 0} / 250 อุปกรณ์
              </span>
            </div>

            <div className="p-6">
              <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {pages.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => setActivePageId(p.id)} 
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      p.id === activePageId 
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-200 dark:ring-indigo-800' 
                        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-500'
                    }`}
                  >
                    <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-1 mb-1.5">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 truncate w-full">
                        <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate">{p.user?.username || p.name}</span>
                      </h3>
                      {p.userId === currentUser?.userId && (
                        <span className="text-[9px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full shrink-0">ของคุณ</span>
                      )}
                      {!p.userId && (
                        <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full shrink-0">ส่วนรวม</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-5">{p.devices.length} / 250 อุปกรณ์</p>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-1/12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-3/12">ชื่อระบบ / อุปกรณ์</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-4/12">IP Address / Domain (Public)</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-3/12">พอร์ต (สูงสุด 2)</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-1/12">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {activePage?.devices.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                        <td className="px-4 py-3 text-center text-sm font-semibold text-slate-400 dark:text-slate-500">{i + 1}</td>
                        <td className="px-4 py-3">
                          <input type="text" value={d.name} onChange={(e) => handleDeviceChange(activePage.id, i, 'name', e.target.value)} disabled={!canEditActivePage} className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder-slate-500 bg-white dark:bg-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-600 disabled:text-slate-500 dark:disabled:text-slate-400" placeholder="เช่น Web Server" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <input 
                              type="text" 
                              value={d.host}
                              onChange={(e) => handleDeviceChange(activePage.id, i, 'host', e.target.value)}
                              disabled={!canEditActivePage}
                              placeholder="e.g. 192.168.1.100"
                              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 dark:text-slate-100 placeholder-slate-500 bg-white dark:bg-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-600 disabled:text-slate-500 dark:disabled:text-slate-400"
                            />
                            {d.ipUpdatedAt && (() => {
                              const updatedAt = new Date(d.ipUpdatedAt!);
                              const diffTime = new Date().getTime() - updatedAt.getTime();
                              const diffDays = Math.floor(Math.abs(diffTime) / (1000 * 60 * 60 * 24));
                              const isRecent = diffTime >= 0 ? diffTime <= 2 * 60 * 60 * 1000 : Math.abs(diffTime) <= 2 * 60 * 60 * 1000;
                              return (
                                <span className={`text-[10px] px-2 py-0.5 mt-1 rounded-md flex items-center gap-1.5 w-fit ${isRecent ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800' : 'text-slate-500/80 italic'}`}>
                                  {isRecent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-pulse"></span>}
                                  <span>
                                    อัปเดต: {updatedAt.toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })} น.
                                    {' '}
                                    (ใช้มา {diffDays} วัน)
                                  </span>
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={d.ports} onChange={(e) => handleDeviceChange(activePage.id, i, 'ports', e.target.value)} disabled={!canEditActivePage} className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 dark:text-slate-100 placeholder-slate-500 bg-white dark:bg-slate-700 disabled:bg-slate-100 dark:disabled:bg-slate-600 disabled:text-slate-500 dark:disabled:text-slate-400" placeholder="80,443" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {canEditActivePage ? (
                            <button onClick={() => removeDevice(i)} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {activePage?.devices.map((d, i) => (
                  <div key={i} className="bg-white dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded">#{i + 1}</span>
                      {canEditActivePage && (
                        <button onClick={() => removeDevice(i)} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">ชื่ออุปกรณ์</label>
                        <input type="text" value={d.name} onChange={(e) => handleDeviceChange(activePage!.id, i, 'name', e.target.value)} disabled={!canEditActivePage}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 disabled:opacity-60"
                          placeholder="เช่น Web Server" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">IP / Host</label>
                        <input type="text" value={d.host} onChange={(e) => handleDeviceChange(activePage!.id, i, 'host', e.target.value)} disabled={!canEditActivePage}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 disabled:opacity-60"
                          placeholder="192.168.1.100" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">พอร์ต</label>
                        <input type="text" value={d.ports} onChange={(e) => handleDeviceChange(activePage!.id, i, 'ports', e.target.value)} disabled={!canEditActivePage}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 disabled:opacity-60"
                          placeholder="80,443" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3 justify-between items-center bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
                {/* Left side: Table Management */}
                <div className="flex flex-wrap gap-2">
                  {canEditActivePage && (
                    <>
                      <button onClick={() => activePage && addDevice(activePage.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg text-xs transition border border-slate-200 shadow-sm">
                        <Plus className="w-3.5 h-3.5" /> เพิ่มอุปกรณ์
                      </button>
                      <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs transition shadow-sm">
                        <Save className="w-3.5 h-3.5" /> บันทึก Database
                      </button>
                    </>
                  )}
                </div>

                {/* Right side: Scanning Actions */}
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex items-center gap-1.5 bg-white dark:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                    <Timer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">ออโต้สแกน:</span>
                    <select
                      value={config.scanInterval || 'off'}
                      onChange={(e) => setConfig({ ...config, scanInterval: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-600 border border-slate-300 dark:border-slate-500 text-slate-700 dark:text-slate-200 text-xs rounded-md px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    >
                      <option value="off">ปิด</option>
                      <option value="1">1 นาที</option>
                      <option value="5">5 นาที</option>
                      <option value="10">10 นาที</option>
                      <option value="30">30 นาที</option>
                    </select>
                    {timeLeft !== null && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatTime(timeLeft)}
                      </span>
                    )}
                  </div>
                  <button onClick={startScan} disabled={scanning} className={`flex items-center gap-1.5 px-4 py-1.5 font-bold rounded-lg text-xs transition shadow-md ${scanning ? 'bg-slate-400 cursor-not-allowed text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}`}>
                    <PlayCircle className="w-4 h-4" /> {scanning ? 'กำลังสแกน...' : 'เริ่มสแกนทั้งหมด'}
                  </button>
                </div>
              </div>
              
              {alert && (
                <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 border ${
                  alert.type === 'error' 
                    ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300' 
                    : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                } animate-in fade-in slide-in-from-top-2 duration-300`}>
                  {alert.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
                  <div className="text-sm font-bold">{alert.message}</div>
                </div>
              )}
            </div>
          </section>

          {/* Loading/Progress Section */}
          {scanning && (
            <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
                  <div>
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">กำลังสแกนพอร์ต...</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">ผลลัพธ์จะแสดงผลแบบ Real-time</p>
                  </div>
                </div>
                <div className="w-full md:w-64">
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1 font-semibold">
                    <span>ความคืบหน้า</span>
                    <span>{scanProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Results Section */}
          {scanResults.length > 0 && (
            <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 bg-slate-800 dark:bg-slate-950 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TableProperties className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold">ผลการตรวจพอร์ต</h2>
                </div>
                <button onClick={exportToTxt} className="flex items-center gap-2 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg text-sm transition border border-slate-600 shadow-sm">
                  <FileText className="w-4 h-4" /> Export (.txt)
                </button>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">ชื่อระบบ / อุปกรณ์</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">IP Address</th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Port 1 (สถานะ)</th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Port 2 (สถานะ)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                      {[...scanResults].sort((a, b) => a.id - b.id).map((result) => (
                        <tr key={result.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{result.name}</td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">{result.host}</td>
                          {Array.from({ length: 2 }).map((_, i) => {
                            const res = result.results[i]
                            if (!res) return <td key={i} className="px-6 py-4 text-center text-slate-400">-</td>
                            const isConnected = res.status === 'CONNECTED'
                            return (
                              <td key={i} className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="font-mono text-xs font-semibold whitespace-nowrap text-slate-700 dark:text-slate-300">Port: {res.port}</span>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${isConnected ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400'}`}>
                                    {res.status} {res.latency != null ? `(${res.latency}ms)` : ''}
                                  </span>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
