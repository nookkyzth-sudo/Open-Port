'use client'

import { useState, useEffect, useRef } from 'react'
import { ShieldAlert, Radio, Server, Database, Timer, Save, ListPlus, Info, PlusCircle, Clock, Plus, RotateCcw, PlayCircle, TableProperties, FileText, X, ChevronLeft, ChevronRight, Edit2, Trash2, AlertCircle, CheckCircle } from 'lucide-react'
import { getAppData, saveAppData } from './actions'

type Device = { name: string, host: string, ports: string }
type Page = { id: string, name: string, devices: Device[] }
type Config = { activePageId: string | null, scanInterval: string | null }
type ScanResult = { id: number, name: string, host: string, results: { port: number, status: string }[] }

export default function Home() {
  const [pages, setPages] = useState<Page[]>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [config, setConfig] = useState<Config>({ activePageId: null, scanInterval: 'off' })
  const [isConnected, setIsConnected] = useState(false) // For API status
  
  const [scanning, setScanning] = useState(false)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [scanProgress, setScanProgress] = useState(0)
  const [totalTargets, setTotalTargets] = useState(0)
  const [finishedCount, setFinishedCount] = useState(0)
  
  const [alert, setAlert] = useState<{ type: 'error'|'success'|'info', message: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const data = await getAppData()
      if (data.pages.length === 0) {
        const initialPage = { id: 'page-1', name: 'หน้า 1', devices: [{ name: '', host: '', ports: '' }] }
        setPages([initialPage])
        setActivePageId('page-1')
      } else {
        setPages(data.pages)
        setActivePageId(data.config?.activePageId || data.pages[0].id)
      }
      setIsConnected(true)
    } catch (err) {
      setIsConnected(false)
      setAlert({ type: 'error', message: 'ไม่สามารถโหลดข้อมูลได้' })
    }
  }

  const handleSave = async () => {
    try {
      await saveAppData({ pages, config: { ...config, activePageId } })
      setAlert({ type: 'success', message: 'บันทึกข้อมูลเรียบร้อยแล้ว' })
      setTimeout(() => setAlert(null), 3000)
    } catch (err) {
      setAlert({ type: 'error', message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' })
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

  const addDevice = () => {
    setPages(prev => prev.map(p => {
      if (p.id !== activePageId) return p
      if (p.devices.length >= 50) {
        setAlert({ type: 'error', message: 'จำกัดสูงสุด 50 อุปกรณ์ต่อหน้า' })
        return p
      }
      return { ...p, devices: [...p.devices, { name: '', host: '', ports: '' }] }
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

  const addNewPage = () => {
    const newPage = { id: `page-${Date.now()}`, name: `หน้า ${pages.length + 1}`, devices: [{ name: '', host: '', ports: '' }] }
    setPages(prev => [...prev, newPage])
    setActivePageId(newPage.id)
  }

  const removePage = (id: string) => {
    if (pages.length <= 1) return setAlert({ type: 'error', message: 'ต้องมีอย่างน้อย 1 หน้า' })
    setPages(prev => prev.filter(p => p.id !== id))
    if (activePageId === id) setActivePageId(pages[0].id)
  }

  const activePage = pages.find(p => p.id === activePageId)

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
          </div>
        </header>

        {alert && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${alert.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            {alert.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
            <div className="text-sm font-medium">{alert.message}</div>
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
                {activePage?.devices.length || 0} / 50 อุปกรณ์
              </span>
            </div>

            <div className="p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {pages.map(p => (
                    <div key={p.id} className="flex items-center gap-1">
                      <button
                        onClick={() => setActivePageId(p.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${p.id === activePageId ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      >
                        {p.name}
                      </button>
                      {pages.length > 1 && (
                        <button onClick={() => removePage(p.id)} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addNewPage} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition shadow-sm">
                  <PlusCircle className="w-4 h-4" /> สร้างหน้าสแกนใหม่
                </button>
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
                    {activePage?.devices.map((dev, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-center text-sm font-semibold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <input type="text" value={dev.name} onChange={(e) => handleDeviceChange(activePage.id, idx, 'name', e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" placeholder="เช่น Web Server" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={dev.host} onChange={(e) => handleDeviceChange(activePage.id, idx, 'host', e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono" placeholder="เช่น 1.1.1.1" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={dev.ports} onChange={(e) => handleDeviceChange(activePage.id, idx, 'ports', e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono" placeholder="80,443" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => removeDevice(idx)} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-wrap gap-3 justify-between items-center">
                <div className="flex gap-2">
                  <button onClick={addDevice} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition">
                    <Plus className="w-4 h-4" /> เพิ่มรายการอุปกรณ์
                  </button>
                  <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-sm transition shadow-sm">
                    <Save className="w-4 h-4" /> บันทึกข้อมูลไปยัง Database
                  </button>
                </div>
                <button onClick={startScan} disabled={scanning} className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-lg text-sm transition shadow-md ${scanning ? 'bg-slate-400 cursor-not-allowed text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}`}>
                  <PlayCircle className="w-4 h-4" /> {scanning ? 'กำลังสแกน...' : 'เริ่มสแกนพอร์ตทั้งหมด'}
                </button>
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
                      {scanResults.map((result, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-900">{result.name}</td>
                          <td className="px-6 py-4 text-slate-500 font-mono text-xs">{result.host}</td>
                          {Array.from({ length: 2 }).map((_, i) => {
                            const res = result.results[i]
                            if (!res) return <td key={i} className="px-6 py-4 text-center">-</td>
                            const isConnected = res.status === 'CONNECTED'
                            return (
                              <td key={i} className="px-6 py-4 text-center">
                                <span className="font-mono text-xs font-semibold block mb-1">Port: {res.port}</span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                  {res.status}
                                </span>
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
