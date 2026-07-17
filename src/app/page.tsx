'use client'

import { useState, useEffect, useRef } from 'react'
import { ShieldAlert, Radio, Server, Database, Timer, Save, ListPlus, Info, PlusCircle, Clock, Plus, RotateCcw, PlayCircle, TableProperties, FileText, X, ChevronLeft, ChevronRight, Edit2, Trash2, AlertCircle, CheckCircle, User, LogOut, Activity, AlertTriangle } from 'lucide-react'
import { getAppData, saveAppData } from './actions'
import { getCurrentUser, logout } from './auth-actions'
import Link from 'next/link'

type Device = { id?: string, name: string, host: string, ports: string, ipUpdatedAt?: string | Date | null, isOffline?: boolean }
type Page = { id: string, name: string, userId?: string | null, user?: { username: string } | null, devices: Device[] }
type Config = { activePageId: string | null, scanInterval: string | null }
type ScanResult = { id: number, name: string, host: string, results: { port: number, status: string }[] }

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
  const isSuperAdmin = currentUser?.username === 'nook.cctv'
  const canEditActivePage = activePage?.userId === currentUser?.userId || isSuperAdmin || !activePage?.userId

  const offlineDevices = pages.flatMap(p => 
    p.devices.map(d => ({ ...d, pageName: p.name, userName: p.user?.username }))
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
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="mb-8 text-center md:text-left md:flex justify-between items-center border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-indigo-700 flex items-center justify-center md:justify-start gap-2">
              <ShieldAlert className="w-8 h-8 text-indigo-600" />
              Bulk Port Scanner <span className="text-sm font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">REAL-TIME (Vercel)</span>
            </h1>
            <p className="text-slate-500 mt-1">เครื่องมือตรวจสอบความปลอดภัยพอร์ตแบบกลุ่ม (สำหรับ Public IP)</p>
          </div>
          <div className="mt-4 md:mt-0 flex gap-2 justify-center flex-wrap">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 ${isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              <Database className="w-3.5 h-3.5" /> {isConnected ? 'Database Connected' : 'Disconnected'}
            </span>
            {currentUser && (
              <>
                <Link href="/bg-scanner" className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition border border-indigo-100">
                  <Activity className="w-3.5 h-3.5" /> Dashboard หลังบ้าน
                </Link>
                <Link href="/profile" className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200 transition border border-slate-200">
                  <User className="w-3.5 h-3.5" /> {currentUser.username}
                </Link>
                <button onClick={() => logout()} className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition border border-rose-100">
                  <LogOut className="w-3.5 h-3.5" /> ออกจากระบบ
                </button>
              </>
            )}
          </div>
        </header>

        {alert && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${alert.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            {alert.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
            <div className="text-sm font-medium">{alert.message}</div>
          </div>
        )}

        {offlineDevices.length > 0 && (
          <div className="mb-6 p-4 rounded-xl flex flex-col gap-2 border bg-rose-50 border-rose-200 text-rose-800 shadow-sm animate-pulse">
            <div className="flex items-center gap-2 font-bold text-rose-900">
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
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold">กำหนดค่าอุปกรณ์และพอร์ตที่ต้องการสแกน</h2>
              </div>
              <span className="bg-indigo-600 text-white text-xs font-semibold px-2.5 py-1 rounded">
                {activePage?.devices.length || 0} / 100 อุปกรณ์
              </span>
            </div>

            <div className="p-6">
              <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {pages.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => setActivePageId(p.id)} 
                    className={`p-3 rounded-xl border cursor-pointer transition ${p.id === activePageId ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
                  >
                    <div className="flex justify-between items-start sm:items-center flex-col sm:flex-row gap-1 mb-1.5">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 truncate w-full">
                        <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate">{p.user?.username || p.name}</span>
                      </h3>
                      {p.userId === currentUser?.userId && (
                        <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full shrink-0">ของคุณ</span>
                      )}
                      {!p.userId && (
                        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full shrink-0">ส่วนรวม</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium ml-5">{p.devices.length} / 100 อุปกรณ์</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase w-1/12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase w-3/12">ชื่อระบบ / อุปกรณ์</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase w-4/12">IP Address / Domain (Public)</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase w-3/12">พอร์ต (สูงสุด 2)</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase w-1/12">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {activePage?.devices.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-center text-sm font-semibold text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <input type="text" value={d.name} onChange={(e) => handleDeviceChange(activePage.id, i, 'name', e.target.value)} disabled={!canEditActivePage} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-slate-900 placeholder-slate-500 disabled:bg-slate-100 disabled:text-slate-500" placeholder="เช่น Web Server" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <input 
                              type="text" 
                              value={d.host}
                              onChange={(e) => handleDeviceChange(activePage.id, i, 'host', e.target.value)}
                              disabled={!canEditActivePage}
                              placeholder="e.g. 192.168.1.100"
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 placeholder-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
                            />
                            {d.ipUpdatedAt && (
                              <span className="text-[10px] text-slate-500/80 italic px-1">
                                อัปเดต: {new Date(d.ipUpdatedAt).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })} น.
                                {' '}
                                (ใช้มา {Math.floor((new Date().getTime() - new Date(d.ipUpdatedAt).getTime()) / (1000 * 60 * 60 * 24))} วัน)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={d.ports} onChange={(e) => handleDeviceChange(activePage.id, i, 'ports', e.target.value)} disabled={!canEditActivePage} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 placeholder-slate-500 disabled:bg-slate-100 disabled:text-slate-500" placeholder="80,443" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {canEditActivePage ? (
                            <button onClick={() => removeDevice(i)} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
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
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                    <Timer className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-700">ออโต้สแกน:</span>
                    <select
                      value={config.scanInterval || 'off'}
                      onChange={(e) => setConfig({ ...config, scanInterval: e.target.value })}
                      className="bg-slate-50 border border-slate-300 text-slate-700 text-xs rounded-md px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    >
                      <option value="off">ปิด</option>
                      <option value="1">1 นาที</option>
                      <option value="5">5 นาที</option>
                      <option value="10">10 นาที</option>
                      <option value="30">30 นาที</option>
                    </select>
                    {timeLeft !== null && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatTime(timeLeft)}
                      </span>
                    )}
                  </div>
                  <button onClick={startScan} disabled={scanning} className={`flex items-center gap-1.5 px-4 py-1.5 font-bold rounded-lg text-xs transition shadow-md ${scanning ? 'bg-slate-400 cursor-not-allowed text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}`}>
                    <PlayCircle className="w-4 h-4" /> {scanning ? 'กำลังสแกน...' : 'เริ่มสแกนทั้งหมด'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Loading/Progress Section */}
          {scanning && (
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
                  <div>
                    <h3 className="font-bold text-slate-700">กำลังสแกนพอร์ต...</h3>
                    <p className="text-xs text-slate-500">ผลลัพธ์จะแสดงผลแบบ Real-time</p>
                  </div>
                </div>
                <div className="w-full md:w-64">
                  <div className="flex justify-between text-xs text-slate-500 mb-1 font-semibold">
                    <span>ความคืบหน้า</span>
                    <span>{scanProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Results Section */}
          {scanResults.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 bg-slate-800 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TableProperties className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold">ผลการตรวจพอร์ต</h2>
                </div>
                <button onClick={exportToTxt} className="flex items-center gap-2 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg text-sm transition border border-slate-600 shadow-sm">
                  <FileText className="w-4 h-4" /> Export (.txt)
                </button>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">ชื่อระบบ / อุปกรณ์</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">IP Address</th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase bg-slate-50/50">Port 1 (สถานะ)</th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase bg-slate-50/50">Port 2 (สถานะ)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {[...scanResults].sort((a, b) => a.id - b.id).map((result) => (
                        <tr key={result.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-900">{result.name}</td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{result.host}</td>
                          {Array.from({ length: 2 }).map((_, i) => {
                            const res = result.results[i]
                            if (!res) return <td key={i} className="px-6 py-4 text-center">-</td>
                            const isConnected = res.status === 'CONNECTED'
                            return (
                              <td key={i} className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="font-mono text-xs font-semibold whitespace-nowrap">Port: {res.port}</span>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                    {res.status}
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
