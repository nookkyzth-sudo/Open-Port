'use client'

import { useState, useEffect, useRef } from 'react'
import { ShieldAlert, Radio, Server, Database, Timer, Save, ListPlus, Info, PlusCircle, Clock, Plus, RotateCcw, PlayCircle, TableProperties, FileText, X, ChevronLeft, ChevronRight, Edit2, Trash2, AlertCircle, CheckCircle, User, LogOut, Activity, AlertTriangle, BarChart2, Upload, Search, Settings } from 'lucide-react'
import { getAppData, saveAppData, getBackgroundScanData } from '../actions'
import { getCurrentUser, logout } from '../auth-actions'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Device = { id?: string, name: string, host: string, ports: string, ipUpdatedAt?: string | Date | null, isOffline?: boolean }
type Page = { id: string, name: string, userId?: string | null, user?: { username: string } | null, devices: Device[] }
type Config = { activePageId: string | null, scanInterval: string | null }
type ScanResult = { id: number, name: string, host: string, results: { port: number, status: string, latency?: number | null }[] }

export default function MobileHome() {
  const router = useRouter()
  const [pages, setPages] = useState<Page[]>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [config, setConfig] = useState<Config>({ activePageId: null, scanInterval: 'off' })
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [scanProgress, setScanProgress] = useState(0)
  const [totalTargets, setTotalTargets] = useState(0)
  const [finishedCount, setFinishedCount] = useState(0)

  const [alert, setAlert] = useState<{ type: 'error' | 'success' | 'info', message: string } | null>(null)
  const [liveOfflineStatuses, setLiveOfflineStatuses] = useState<Record<string, boolean>>({})

  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const timeLeftRef = useRef<number | null>(null)
  const startScanRef = useRef<() => void>(() => { })
  
  // Mobile specific states
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newDevice, setNewDevice] = useState<Device>({ name: '', host: '', ports: '' })

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    loadData()
    const fetchOffline = async () => {
      try {
        const data = await getBackgroundScanData()
        const statusMap: Record<string, boolean> = {}
        data.forEach((d: any) => { statusMap[d.id] = d.isOffline })
        setLiveOfflineStatuses(statusMap)
      } catch (e) { }
    }
    fetchOffline()
    const offlineIntv = setInterval(fetchOffline, 30000)
    return () => clearInterval(offlineIntv)
  }, [])

  useEffect(() => {
    startScanRef.current = startScan
  }, [pages, activePageId])

  useEffect(() => { timeLeftRef.current = timeLeft }, [timeLeft])

  useEffect(() => {
    if (config.scanInterval && config.scanInterval !== 'off') {
      const minutes = parseInt(config.scanInterval)
      if (!isNaN(minutes) && minutes > 0) setTimeLeft(minutes * 60)
      else setTimeLeft(null)
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
        if (!isNaN(minutes) && minutes > 0) setTimeLeft(minutes * 60)
        else setTimeLeft(null)
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
        setTimeout(() => setAlert(null), 3000)
        const freshData = await getAppData()
        setPages(freshData.pages as Page[])
      }
    } catch (err: any) {
      setAlert({ type: 'error', message: `Error: ${err?.message || String(err)}` })
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

  const removeDevice = (devIndex: number) => {
    setPages(prev => prev.map(p => {
      if (p.id !== activePageId) return p
      const newDevices = p.devices.filter((_, i) => i !== devIndex)
      return { ...p, devices: newDevices }
    }))
  }

  const handleAddNewDevice = () => {
    if (!activePageId) return
    if (!newDevice.name || !newDevice.host || !newDevice.ports) {
      setAlert({ type: 'error', message: 'กรุณากรอกข้อมูลให้ครบถ้วน' })
      setTimeout(() => setAlert(null), 3000)
      return
    }
    setPages(prev => prev.map(p => {
      if (p.id !== activePageId) return p
      return { ...p, devices: [...p.devices, newDevice] }
    }))
    setNewDevice({ name: '', host: '', ports: '' })
    setShowAddModal(false)
    setAlert({ type: 'success', message: 'เพิ่มอุปกรณ์แล้ว อย่าลืมกดบันทึก' })
    setTimeout(() => setAlert(null), 3000)
  }

  const activePage = pages.find(p => p.id === activePageId)
  const isSuperAdmin = currentUser?.role === 'ADMIN'
  const isViewer = currentUser?.role === 'VIEWER'
  const canEditActivePage = !isViewer && (activePage?.userId === currentUser?.userId || isSuperAdmin || !activePage?.userId)

  const startScan = async () => {
    if (!activePage) return
    if (activePage.devices.length === 0) {
      setAlert({ type: 'error', message: `ไม่มีอุปกรณ์ให้สแกน` })
      return
    }

    const targetsToScan: any[] = []
    for (let i = 0; i < activePage.devices.length; i++) {
      const dev = activePage.devices[i]
      if (!dev.name || !dev.host || !dev.ports) {
        return setAlert({ type: 'error', message: `อุปกรณ์ "${dev.name || 'ไม่ระบุชื่อ'}" ข้อมูลไม่สมบูรณ์` })
      }
      const ports = dev.ports.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0 && p <= 65535)
      if (ports.length === 0 || ports.length > 2) {
        return setAlert({ type: 'error', message: `อุปกรณ์ "${dev.name}" พอร์ตไม่ถูกต้อง` })
      }
      targetsToScan.push({ name: dev.name, host: dev.host, ports })
    }

    setAlert(null)
    setScanning(true)
    setScanResults([])
    setTotalTargets(targetsToScan.length)
    setFinishedCount(0)
    setScanProgress(0)
    setShowResultsModal(true)

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
    <div className="relative pb-24">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-indigo-600 text-white px-4 py-3 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain bg-white rounded-full p-1" />
            <h1 className="text-lg font-bold">Port Scanner</h1>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="bg-emerald-500 w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></span>
            ) : (
              <span className="bg-red-500 w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
            )}
          </div>
        </div>
      </header>

      {/* Alert Toast */}
      {alert && (
        <div className="fixed top-16 left-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className={`p-3 rounded-lg shadow-lg flex items-center gap-3 border ${
            alert.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {alert.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-bold flex-1">{alert.message}</span>
            <button onClick={() => setAlert(null)}><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Pages Selector (Horizontal Scroll) */}
      <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
          {pages.map(p => (
            <button
              key={p.id}
              onClick={() => setActivePageId(p.id)}
              className={`snap-center shrink-0 flex flex-col items-start px-3 py-2 rounded-xl border transition-all min-w-[120px] ${
                p.id === activePageId 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200'
              }`}
            >
              <div className="text-xs font-bold truncate w-full flex items-center gap-1.5">
                <User className="w-3 h-3" />
                {p.user?.username || p.name}
              </div>
              <div className={`text-[10px] mt-1 ${p.id === activePageId ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                {p.devices.length} อุปกรณ์
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Device List */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">รายการอุปกรณ์</h2>
          <span className="text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
            {activePage?.devices.length || 0} รายการ
          </span>
        </div>

        {activePage?.devices.map((d, i) => {
          const isOffline = d.id && liveOfflineStatuses[d.id] !== undefined ? liveOfflineStatuses[d.id] : d.isOffline;
          return (
            <div key={i} className={`bg-white dark:bg-slate-800 rounded-xl border p-3 shadow-sm relative overflow-hidden ${
              isOffline ? 'border-red-300 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800' : 'border-slate-200 dark:border-slate-700'
            }`}>
              {isOffline && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                  OFFLINE
                </div>
              )}
              <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex-1 pr-12">
                  <input 
                    type="text" 
                    value={d.name} 
                    onChange={(e) => handleDeviceChange(activePage.id, i, 'name', e.target.value)}
                    disabled={!canEditActivePage}
                    className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none pb-0.5 text-sm truncate placeholder-slate-400"
                    placeholder="ชื่ออุปกรณ์..."
                  />
                </div>
                {canEditActivePage && (
                  <button onClick={() => removeDevice(i)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="space-y-2 mt-2">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-100 dark:bg-slate-700 p-1.5 rounded-md"><Server className="w-3.5 h-3.5 text-slate-500" /></div>
                  <input 
                    type="text" 
                    value={d.host} 
                    onChange={(e) => handleDeviceChange(activePage.id, i, 'host', e.target.value)}
                    disabled={!canEditActivePage}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="IP/Host"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-slate-100 dark:bg-slate-700 p-1.5 rounded-md"><Radio className="w-3.5 h-3.5 text-slate-500" /></div>
                  <input 
                    type="text" 
                    value={d.ports} 
                    onChange={(e) => handleDeviceChange(activePage.id, i, 'ports', e.target.value)}
                    disabled={!canEditActivePage}
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Ports (เช่น 80,443)"
                  />
                </div>
              </div>
            </div>
          )
        })}

        {activePage?.devices.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            ไม่มีอุปกรณ์ในหน้านี้
          </div>
        )}

        {/* Padding for FABs */}
        <div className="h-16"></div>
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-20 right-4 flex flex-col gap-3 items-end z-30">
        {canEditActivePage && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-12 h-12 bg-white text-indigo-600 rounded-full shadow-lg border border-indigo-100 flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-transform"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
        
        {canEditActivePage && (
          <button 
            onClick={handleSave}
            className="w-12 h-12 bg-emerald-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-emerald-600 active:scale-95 transition-transform"
          >
            <Save className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Fixed Start Scan Button at bottom (above Nav) */}
      <div className="fixed bottom-16 left-0 right-0 p-3 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent dark:from-slate-900 dark:via-slate-900 z-30">
        <button 
          onClick={startScan} 
          disabled={scanning}
          className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-white shadow-lg transition-transform active:scale-95 ${
            scanning ? 'bg-slate-400 opacity-80 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30'
          }`}
        >
          {scanning ? (
            <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> กำลังสแกน...</>
          ) : (
            <><PlayCircle className="w-5 h-5" /> เริ่มสแกนทั้งหมด</>
          )}
        </button>
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end">
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl p-5 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">เพิ่มอุปกรณ์ใหม่</h3>
              <button onClick={() => setShowAddModal(false)}><X className="w-6 h-6 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">ชื่ออุปกรณ์</label>
                <input type="text" value={newDevice.name} onChange={e => setNewDevice({...newDevice, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-500" placeholder="ระบุชื่อ..." />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">IP / Host</label>
                <input type="text" value={newDevice.host} onChange={e => setNewDevice({...newDevice, host: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:border-indigo-500" placeholder="192.168.1.100" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">พอร์ต (สูงสุด 2 พอร์ต)</label>
                <input type="text" value={newDevice.ports} onChange={e => setNewDevice({...newDevice, ports: e.target.value})} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:border-indigo-500" placeholder="เช่น 80,443" />
              </div>
              <button onClick={handleAddNewDevice} className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-md mt-2">
                เพิ่มข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scan Results Full-Screen Modal */}
      {showResultsModal && (
        <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="bg-indigo-600 text-white px-4 py-3 flex justify-between items-center shadow-md">
            <h2 className="font-bold flex items-center gap-2">
              <TableProperties className="w-5 h-5" /> 
              ผลการสแกน
            </h2>
            <button onClick={() => setShowResultsModal(false)} className="bg-white/20 p-1.5 rounded-full hover:bg-white/30">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-2">
            <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
              <span>ความคืบหน้า</span>
              <span>{finishedCount} / {totalTargets} ({scanProgress}%)</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }}></div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {scanResults.map(result => (
              <div key={result.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm">
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-1">{result.name}</div>
                <div className="text-xs text-slate-500 font-mono mb-3">{result.host}</div>
                
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 2 }).map((_, i) => {
                    const res = result.results[i]
                    if (!res) return <div key={i} className="text-center text-slate-300 text-xs py-1">-</div>
                    const isConnected = res.status === 'CONNECTED'
                    return (
                      <div key={i} className={`flex flex-col items-center justify-center p-2 rounded-lg border ${
                        isConnected ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20' : 'bg-red-50 border-red-200 dark:bg-red-900/20'
                      }`}>
                        <span className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Port {res.port}</span>
                        <span className={`text-xs font-bold ${isConnected ? 'text-emerald-600' : 'text-red-600'}`}>
                          {res.status}
                        </span>
                        {res.latency && <span className="text-[9px] text-slate-500 mt-0.5">{res.latency}ms</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            
            {scanResults.length === 0 && !scanning && (
              <div className="text-center text-slate-500 py-10">ไม่พบผลลัพธ์</div>
            )}
            
            {scanning && (
              <div className="flex justify-center items-center gap-2 py-4 text-indigo-600">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent"></div>
                <span className="text-sm font-bold">กำลังสแกน...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
