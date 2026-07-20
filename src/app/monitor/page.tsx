'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity, PlayCircle, Square, AlertTriangle, CheckCircle, Clock, ArrowLeft, RefreshCw, ServerCrash, Settings2 } from 'lucide-react'
import Link from 'next/link'

type LogEntry = {
  time: Date
  host: string
  port: number
  status: string
  message: string
}

type PortStatus = {
  port: number
  status: string | null
  latency: number | null
}

type HostStatus = {
  host: string
  name: string
  results: PortStatus[]
}

type TargetSet = {
  ip: string
  port1: string
  port2: string
}

export default function MonitorPage() {
  const [targets, setTargets] = useState<TargetSet[]>([
    { ip: '', port1: '80', port2: '' },
    { ip: '', port1: '80', port2: '' },
    { ip: '', port1: '80', port2: '' },
    { ip: '', port1: '80', port2: '' },
    { ip: '', port1: '80', port2: '' }
  ])
  
  const [intervalSecs, setIntervalSecs] = useState(30)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(30)
  
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [currentStatuses, setCurrentStatuses] = useState<HostStatus[]>([])
  
  const monitorRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  
  // To track state changes: { "192.168.1.1-80": "CONNECTED" }
  const prevStatusesRef = useRef<Record<string, string>>({})
  
  // Clean up timers
  useEffect(() => {
    return () => stopMonitoring()
  }, [])

  const handleTargetChange = (index: number, field: keyof TargetSet, value: string) => {
    const newTargets = [...targets]
    newTargets[index] = { ...newTargets[index], [field]: value }
    setTargets(newTargets)
  }

  const startMonitoring = () => {
    const activeTargets = targets.map((t, idx) => ({ ...t, index: idx })).filter(t => t.ip.trim().length > 0)
    
    if (activeTargets.length === 0) {
      alert('กรุณาระบุ IP หรือ โดเมน อย่างน้อย 1 ชุด')
      return
    }

    // Validate ports
    for (const t of activeTargets) {
      if (isNaN(parseInt(t.port1))) {
        alert(`กรุณาระบุ Port 1 ให้ถูกต้อง ในชุดที่ ${t.index + 1}`)
        return
      }
    }
    
    setIsMonitoring(true)
    setStartTime(new Date())
    setLogs([]) // Clear history on start
    prevStatusesRef.current = {}
    
    const apiTargets = activeTargets.map(t => {
      const ports = [parseInt(t.port1)]
      const p2 = parseInt(t.port2)
      if (!isNaN(p2) && p2 > 0) ports.push(p2)
      return {
        name: `ชุดที่ ${t.index + 1}`,
        host: t.ip.trim(),
        ports
      }
    })

    setCurrentStatuses(apiTargets.map(t => ({ name: t.name, host: t.host, results: [] })))
    
    // First scan immediately
    scanNow(apiTargets)
    
    // Setup interval
    setCountdown(intervalSecs)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          scanNow(apiTargets)
          return intervalSecs
        }
        return prev - 1
      })
    }, 1000)
  }

  const stopMonitoring = () => {
    setIsMonitoring(false)
    setStartTime(null)
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (monitorRef.current) clearInterval(monitorRef.current)
  }

  const scanNow = async (apiTargets: any[]) => {
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: apiTargets })
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
              handleScanResult(data.host, data.results)
            }
          }
        }
      }
    } catch (err) {
      // API error
      apiTargets.forEach(t => {
        t.ports.forEach((p: number) => {
          addLog(t.host, p, 'ERROR', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์สแกนได้')
        })
      })
    }
  }

  const handleScanResult = (host: string, results: PortStatus[]) => {
    setCurrentStatuses(prev => {
      const copy = [...prev]
      const idx = copy.findIndex(c => c.host === host)
      if (idx !== -1) {
        copy[idx] = { ...copy[idx], results }
      }
      return copy
    })
    
    results.forEach(res => {
      const stateKey = `${host}-${res.port}`
      const prevStatus = prevStatusesRef.current[stateKey]
      
      if (res.status !== 'CONNECTED') {
        if (!prevStatus || prevStatus === 'CONNECTED') {
          addLog(host, res.port, res.status || 'ERROR', `การเชื่อมต่อขาดหาย (Timeout/Closed)`)
        }
      } else if (res.status === 'CONNECTED') {
        if (prevStatus && prevStatus !== 'CONNECTED') {
           addLog(host, res.port, res.status, `เชื่อมต่อกลับมาได้แล้ว (${res.latency}ms)`)
        }
      }
      
      prevStatusesRef.current[stateKey] = res.status || 'ERROR'
    })
  }

  const addLog = (host: string, port: number, status: string, message: string) => {
    setLogs(prev => [{
      time: new Date(),
      host,
      port,
      status,
      message
    }, ...prev])
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
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
            <p className="text-slate-500 text-sm mt-1">เครื่องมือตรวจสอบความเสถียร (Ping test อัตโนมัติแบบกลุ่ม)</p>
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
            {isMonitoring && startTime && (
              <div className="text-center border-l pl-4 border-slate-200">
                <div className="text-xs text-slate-500 font-bold mb-1 uppercase tracking-wider">เริ่มทดสอบเมื่อ</div>
                <div className="text-sm font-bold text-slate-700 flex items-center justify-center gap-1">
                  {startTime.toLocaleTimeString('th-TH')}
                </div>
              </div>
            )}
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 h-fit lg:col-span-5 xl:col-span-4">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-3 border-slate-100">
              <ServerCrash className="w-5 h-5 text-indigo-500" /> ตั้งค่าเป้าหมาย
            </h2>
            
            <div className="space-y-4">
              
              <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3">
                {targets.map((target, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border ${target.ip ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="text-xs font-bold text-slate-500 mb-2">ชุดที่ {idx + 1}</div>
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        value={target.ip}
                        onChange={e => handleTargetChange(idx, 'ip', e.target.value)}
                        disabled={isMonitoring}
                        placeholder="IP Address หรือ Domain"
                        className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono disabled:opacity-60"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Port หลัก</label>
                          <input 
                            type="text" 
                            value={target.port1}
                            onChange={e => handleTargetChange(idx, 'port1', e.target.value)}
                            disabled={isMonitoring}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono disabled:opacity-60"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Port รอง</label>
                          <input 
                            type="text" 
                            value={target.port2}
                            onChange={e => handleTargetChange(idx, 'port2', e.target.value)}
                            disabled={isMonitoring}
                            placeholder="เว้นว่างได้"
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono disabled:opacity-60"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-2">
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5"><Settings2 className="w-4 h-4" /> รอบสแกนทุกๆ (วินาที)</label>
                <select 
                  value={intervalSecs}
                  onChange={e => setIntervalSecs(parseInt(e.target.value))}
                  disabled={isMonitoring}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 font-bold text-slate-700"
                >
                  <option value={5}>5 วินาที</option>
                  <option value={10}>10 วินาที</option>
                  <option value={15}>15 วินาที</option>
                  <option value={30}>30 วินาที</option>
                  <option value={60}>60 วินาที</option>
                </select>
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
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            
            {/* Live Status Cards (Scrollable if many) */}
            {currentStatuses.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 pb-2">
                {currentStatuses.map((hs, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                       <span className="font-bold text-slate-600 text-xs">{hs.name}</span>
                       <span className="font-bold text-indigo-700 font-mono text-sm truncate max-w-[120px]">{hs.host}</span>
                    </div>
                    <div className="p-4 grid grid-cols-1 gap-2 flex-1">
                      {hs.results.length === 0 ? (
                        <div className="text-center text-slate-400 text-sm py-4">กำลังโหลด...</div>
                      ) : (
                        hs.results.map(s => (
                          <div key={s.port} className={`p-3 rounded-xl border ${s.status === 'CONNECTED' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                            <div className="flex justify-between items-start mb-1">
                              <div className="font-bold text-xs text-slate-500">Port {s.port}</div>
                              {s.status === 'CONNECTED' ? (
                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                              )}
                            </div>
                            <div className={`text-base font-extrabold ${s.status === 'CONNECTED' ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {s.status === 'CONNECTED' ? 'ONLINE' : 'OFFLINE'}
                            </div>
                            <div className="text-[10px] font-semibold mt-1 opacity-70 truncate">
                              {s.status === 'CONNECTED' ? `${s.latency} ms` : 'Timeout'}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Logs */}
            <div className="bg-white flex-1 rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[300px]">
              <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                <h3 className="font-bold">ประวัติการเชื่อมต่อหลุด (Disconnect History)</h3>
                <span className="text-xs bg-slate-700 px-2 py-1 rounded font-mono">{logs.length} events</span>
              </div>
              <div className="p-0 overflow-y-auto max-h-[400px]">
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
                              <div className="font-bold text-slate-800">
                                {log.host} <span className="text-slate-500 text-sm">(Port {log.port})</span>
                              </div>
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
