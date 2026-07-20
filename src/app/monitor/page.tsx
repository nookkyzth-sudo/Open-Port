'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity, PlayCircle, Square, AlertTriangle, CheckCircle, Clock, ArrowLeft, RefreshCw, ServerCrash } from 'lucide-react'
import Link from 'next/link'

type LogEntry = {
  time: Date
  port: number
  status: string
  message: string
}

type PortStatus = {
  port: number
  status: string | null
  latency: number | null
}

export default function MonitorPage() {
  const [host, setHost] = useState('')
  const [port1, setPort1] = useState('80')
  const [port2, setPort2] = useState('')
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [countdown, setCountdown] = useState(30)
  
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [currentStatuses, setCurrentStatuses] = useState<PortStatus[]>([])
  
  const monitorRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const prevStatusesRef = useRef<Record<number, string>>({})
  
  // Clean up timers
  useEffect(() => {
    return () => stopMonitoring()
  }, [])

  const startMonitoring = () => {
    if (!host) {
      alert('กรุณาระบุ IP หรือ โดเมน')
      return
    }
    const p1 = parseInt(port1)
    if (isNaN(p1)) {
      alert('กรุณาระบุ Port 1 ให้ถูกต้อง')
      return
    }
    
    setIsMonitoring(true)
    setLogs([]) // Clear history on start
    prevStatusesRef.current = {}
    setCurrentStatuses([])
    
    // First scan immediately
    scanNow()
    
    // Setup interval for every 30 seconds
    setCountdown(30)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          scanNow()
          return 30
        }
        return prev - 1
      })
    }, 1000)
  }

  const stopMonitoring = () => {
    setIsMonitoring(false)
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (monitorRef.current) clearInterval(monitorRef.current)
  }

  const scanNow = async () => {
    const p1 = parseInt(port1)
    const p2 = parseInt(port2)
    const ports = [p1]
    if (!isNaN(p2) && p2 > 0) ports.push(p2)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: [{ name: 'MonitorTarget', host, ports }] })
      })

      if (!res.body) throw new Error('No stream')

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
              handleScanResult(data.results)
            }
          }
        }
      }
    } catch (err) {
      // API error
      ports.forEach(p => {
        addLog(p, 'ERROR', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์สแกนได้')
      })
    }
  }

  const handleScanResult = (results: { port: number, status: string, latency: number | null }[]) => {
    setCurrentStatuses(results)
    
    results.forEach(res => {
      const prevStatus = prevStatusesRef.current[res.port]
      
      // If it's the first time and it's closed, log it. Or if status changed from CONNECTED to CLOSED
      if (res.status !== 'CONNECTED') {
        if (!prevStatus || prevStatus === 'CONNECTED') {
          addLog(res.port, res.status, `การเชื่อมต่อขาดหาย (Timeout/Closed)`)
        }
      } else if (res.status === 'CONNECTED') {
        if (prevStatus && prevStatus !== 'CONNECTED') {
           // It came back online
           addLog(res.port, res.status, `เชื่อมต่อกลับมาได้แล้ว (${res.latency}ms)`)
        }
      }
      
      prevStatusesRef.current[res.port] = res.status
    })
  }

  const addLog = (port: number, status: string, message: string) => {
    setLogs(prev => [{
      time: new Date(),
      port,
      status,
      message
    }, ...prev])
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/" className="text-slate-500 hover:text-indigo-600 transition flex items-center gap-1 text-sm bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
                <ArrowLeft className="w-4 h-4" /> กลับหน้าแรก
              </Link>
            </div>
            <h1 className="text-2xl font-extrabold text-indigo-700 flex items-center gap-2">
              <Activity className="w-6 h-6" /> Port & IP Monitor
            </h1>
            <p className="text-slate-500 text-sm mt-1">เครื่องมือตรวจสอบความเสถียร (Ping test ทุก 30 วินาที)</p>
          </div>
          
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">สถานะ</div>
              <div className={`text-sm font-bold flex items-center justify-center gap-1.5 ${isMonitoring ? 'text-emerald-600' : 'text-slate-400'}`}>
                {isMonitoring ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> กำลังตรวจสอบ</>
                ) : (
                  <><Square className="w-4 h-4" /> หยุดทำงาน</>
                )}
              </div>
            </div>
            {isMonitoring && (
              <div className="text-center border-l pl-4 border-slate-200">
                <div className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">อัปเดตใน</div>
                <div className="text-sm font-bold text-indigo-600 flex items-center justify-center gap-1">
                  <Clock className="w-4 h-4" /> {countdown} วิ
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-3 border-slate-100">
              <ServerCrash className="w-5 h-5 text-indigo-500" /> ตั้งค่าเป้าหมาย
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">IP Address / Domain</label>
                <input 
                  type="text" 
                  value={host}
                  onChange={e => setHost(e.target.value)}
                  disabled={isMonitoring}
                  placeholder="เช่น 118.175.x.x"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono disabled:opacity-60"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Port 1 (หลัก)</label>
                  <input 
                    type="text" 
                    value={port1}
                    onChange={e => setPort1(e.target.value)}
                    disabled={isMonitoring}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Port 2 (รอง)</label>
                  <input 
                    type="text" 
                    value={port2}
                    onChange={e => setPort2(e.target.value)}
                    disabled={isMonitoring}
                    placeholder="เว้นว่างได้"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                {isMonitoring ? (
                  <button 
                    onClick={stopMonitoring}
                    className="w-full py-3 bg-rose-100 text-rose-700 hover:bg-rose-200 hover:text-rose-800 font-bold rounded-xl transition flex justify-center items-center gap-2"
                  >
                    <Square className="w-5 h-5" /> หยุดการตรวจสอบ
                  </button>
                ) : (
                  <button 
                    onClick={startMonitoring}
                    className="w-full py-3 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl transition shadow-md shadow-indigo-200 flex justify-center items-center gap-2"
                  >
                    <PlayCircle className="w-5 h-5" /> เริ่มตรวจสอบ
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Status & History */}
          <div className="md:col-span-2 flex flex-col gap-6">
            
            {/* Live Status Cards */}
            {currentStatuses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentStatuses.map(s => (
                  <div key={s.port} className={`p-4 rounded-2xl border ${s.status === 'CONNECTED' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-sm text-slate-500">Port {s.port}</div>
                      {s.status === 'CONNECTED' ? (
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 text-rose-500" />
                      )}
                    </div>
                    <div className={`text-xl font-extrabold ${s.status === 'CONNECTED' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {s.status === 'CONNECTED' ? 'ONLINE' : 'OFFLINE'}
                    </div>
                    <div className="text-xs font-semibold mt-1 opacity-70">
                      {s.status === 'CONNECTED' ? `Latency: ${s.latency} ms` : 'ไม่สามารถเชื่อมต่อได้ (Timeout)'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Logs */}
            <div className="bg-white flex-1 rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
              <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                <h3 className="font-bold">ประวัติการเชื่อมต่อหลุด (Disconnect History)</h3>
                <span className="text-xs bg-slate-700 px-2 py-1 rounded font-mono">{logs.length} events</span>
              </div>
              <div className="p-0 overflow-y-auto max-h-[500px]">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                    <CheckCircle className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">ยังไม่พบปัญหาพอร์ตหลุด</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {logs.map((log, idx) => (
                      <li key={idx} className={`p-4 hover:bg-slate-50 ${log.status === 'CONNECTED' ? 'border-l-4 border-emerald-500' : 'border-l-4 border-rose-500'}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                              {log.status === 'CONNECTED' ? (
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <AlertTriangle className="w-5 h-5 text-rose-500" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">Port {log.port}</div>
                              <div className="text-sm font-semibold text-slate-600">{log.message}</div>
                            </div>
                          </div>
                          <div className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
                            {log.time.toLocaleTimeString('th-TH')}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
