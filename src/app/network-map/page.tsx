'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  NodeProps,
  Handle,
  Position,
  Panel,
  Node,
  Edge
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { getDashboardData } from '../actions'
import { Server, Activity, Monitor, ArrowLeft, Loader2, X, AlertCircle } from 'lucide-react'
import Link from 'next/link'

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
}

// Custom Node: Root
function RootNode() {
  return (
    <div className="px-6 py-4 shadow-xl rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-4 border-indigo-400 dark:border-indigo-900 flex flex-col items-center justify-center gap-2">
      <Server className="w-8 h-8" />
      <div className="font-extrabold tracking-wide">Main Server / Cloud</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-200" />
    </div>
  )
}

// Custom Node: Owner
function OwnerNode({ data }: NodeProps) {
  return (
    <div className="px-5 py-3 shadow-lg rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center min-w-[150px]">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-300" />
      <div className="font-bold text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">กลุ่ม/แผนก</div>
      <div className="font-bold text-lg text-indigo-600 dark:text-indigo-400">{data.label as string}</div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-300" />
    </div>
  )
}

// Custom Node: Device
function DeviceNode({ data, selected }: NodeProps) {
  const dev = data.device as DeviceStat
  let statusColor = 'bg-emerald-500'
  let borderColor = 'border-emerald-200 dark:border-emerald-800'
  let glow = 'shadow-[0_0_15px_rgba(16,185,129,0.3)]'
  
  if (dev.isOffline) {
    statusColor = 'bg-rose-500'
    borderColor = 'border-rose-300 dark:border-rose-900'
    glow = 'shadow-[0_0_15px_rgba(244,63,94,0.4)]'
  } else if (dev.avgLatency && dev.avgLatency > 150) {
    statusColor = 'bg-orange-500'
    borderColor = 'border-orange-200 dark:border-orange-800'
    glow = 'shadow-[0_0_15px_rgba(249,115,22,0.3)]'
  }

  return (
    <div className={`px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-800 flex items-center gap-3 w-[220px] transition-all duration-300 ${borderColor} ${glow} ${selected ? 'ring-4 ring-sky-400/50 scale-105' : ''}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" style={{ background: statusColor.replace('bg-', '') }} />
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${statusColor} text-white`}>
        <Monitor className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{dev.name || 'Unknown'}</div>
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">{dev.host}</div>
      </div>
    </div>
  )
}


export default function NetworkMapPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDevice, setSelectedDevice] = useState<DeviceStat | null>(null)

  const nodeTypes = useMemo(() => ({ rootNode: RootNode, ownerNode: OwnerNode, deviceNode: DeviceNode }), [])

  useEffect(() => {
    loadMapData()
  }, [])

  const loadMapData = async () => {
    try {
      setLoading(true)
      const data = await getDashboardData()
      
      const newNodes: any[] = []
      const newEdges: any[] = []

      // Root
      newNodes.push({ 
        id: 'root', 
        position: { x: 0, y: 0 }, 
        data: { label: 'Main Server' }, 
        type: 'rootNode' 
      })

      const devices = data.deviceStats
      const owners = Array.from(new Set(devices.map((d: any) => d.owner)))
      
      const ownerSpacing = 500
      
      owners.forEach((owner: string, i) => {
        const oX = (i - (owners.length - 1) / 2) * ownerSpacing
        const oY = 250
        
        newNodes.push({
          id: `owner-${owner}`,
          position: { x: oX, y: oY },
          data: { label: owner },
          type: 'ownerNode'
        })
        
        newEdges.push({
          id: `e-root-owner-${owner}`,
          source: 'root',
          target: `owner-${owner}`,
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2, opacity: 0.6 }
        })

        const ownerDevices = devices.filter((d: any) => d.owner === owner)
        const devSpacing = 240
        // Determine layout for devices (maybe multiple rows if many)
        const MAX_PER_ROW = 4
        ownerDevices.forEach((dev: any, j: number) => {
          const row = Math.floor(j / MAX_PER_ROW)
          const col = j % MAX_PER_ROW
          const numInRow = Math.min(MAX_PER_ROW, ownerDevices.length - row * MAX_PER_ROW)
          
          const dX = oX + (col - (numInRow - 1) / 2) * devSpacing
          const dY = oY + 250 + (row * 150)
          
          newNodes.push({
            id: dev.id,
            position: { x: dX, y: dY },
            data: { device: dev },
            type: 'deviceNode'
          })

          let color = '#10b981' // emerald-500
          if (dev.isOffline) color = '#f43f5e' // rose-500
          else if (dev.avgLatency && dev.avgLatency > 150) color = '#f97316' // orange-500

          newEdges.push({
            id: `e-owner-${owner}-${dev.id}`,
            source: `owner-${owner}`,
            target: dev.id,
            animated: !dev.isOffline,
            style: { stroke: color, strokeWidth: dev.isOffline ? 1 : 2, opacity: dev.isOffline ? 0.3 : 0.8 }
          })
        })
      })

      setNodes(newNodes)
      setEdges(newEdges)
    } catch (err: any) {
      setError('ไม่สามารถโหลดข้อมูลแผนผังได้')
    } finally {
      setLoading(false)
    }
  }

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    if (node.type === 'deviceNode') {
      setSelectedDevice(node.data.device)
    } else {
      setSelectedDevice(null)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-bold animate-pulse">กำลังประมวลผลโครงข่ายแผนผัง...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-50 text-red-600 p-6 rounded-xl flex items-center gap-3 border border-red-200">
          <AlertCircle className="w-6 h-6" />
          <span className="font-bold">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Header Panel overlaid on map */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50">
        <Link href="/" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition">
          <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
            <Activity className="w-5 h-5" /> Network Map
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">ภาพรวมการเชื่อมต่อระบบ</p>
        </div>
      </div>
      
      {/* Legend overlaid on map */}
      <div className="absolute bottom-6 left-6 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 flex flex-col gap-2">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">สัญลักษณ์ (Legend)</div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span> Online / เร็ว
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></span> Online / ช้า ({'>'} 150ms)
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span> Offline
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        className="bg-slate-50 dark:bg-slate-950"
      >
        <Background color="#94a3b8" gap={16} size={1} />
        <Controls className="!bg-white dark:!bg-slate-800 !border-slate-200 dark:!border-slate-700 !shadow-lg rounded-xl overflow-hidden [&>button]:!border-slate-200 dark:[&>button]:!border-slate-700 [&>button]:!bg-transparent dark:[&>button]:!fill-slate-300 [&>button:hover]:!bg-slate-100 dark:[&>button:hover]:!bg-slate-700" />
        <MiniMap 
          nodeColor={(node) => {
            if (node.type === 'rootNode') return '#4f46e5'
            if (node.type === 'ownerNode') return '#94a3b8'
            if (node.type === 'deviceNode') {
              const d = node.data.device as DeviceStat
              if (d.isOffline) return '#f43f5e'
              if (d.avgLatency && d.avgLatency > 150) return '#f97316'
              return '#10b981'
            }
            return '#eee'
          }}
          className="!bg-white/50 dark:!bg-slate-800/50 !backdrop-blur-md rounded-xl !border !border-slate-200/50 dark:!border-slate-700/50 shadow-lg"
          maskColor="rgba(0,0,0, 0.1)"
        />
      </ReactFlow>

      {/* Side Panel for Node Details */}
      <div className={`absolute top-4 right-4 bottom-4 w-80 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-700 transition-transform duration-300 ease-in-out z-20 flex flex-col ${selectedDevice ? 'translate-x-0' : 'translate-x-[120%]'}`}>
        {selectedDevice && (
          <>
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start">
              <div>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-3 ${selectedDevice.isOffline ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400' : (selectedDevice.avgLatency && selectedDevice.avgLatency > 150 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400')}`}>
                  <span className={`w-2 h-2 rounded-full ${selectedDevice.isOffline ? 'bg-rose-500' : (selectedDevice.avgLatency && selectedDevice.avgLatency > 150 ? 'bg-orange-500' : 'bg-emerald-500')} ${!selectedDevice.isOffline && 'animate-pulse'}`}></span>
                  {selectedDevice.isOffline ? 'OFFLINE' : (selectedDevice.avgLatency && selectedDevice.avgLatency > 150 ? 'SLOW' : 'ONLINE')}
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white truncate">{selectedDevice.name || 'Unknown Device'}</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{selectedDevice.owner}</p>
              </div>
              <button onClick={() => setSelectedDevice(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 flex-1 overflow-y-auto space-y-6">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase mb-1">Host / IP Address</div>
                <div className="font-mono text-sm font-semibold bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 break-all">{selectedDevice.host}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ports</div>
                  <div className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{selectedDevice.ports || '-'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Uptime (7 วัน)</div>
                  <div className="font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{selectedDevice.uptimePct}%</div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center justify-between">
                  <span>สถานะความหน่วง (Latency)</span>
                  {selectedDevice.avgLatency && (
                    <span className="text-indigo-600 dark:text-indigo-400">เฉลี่ย {selectedDevice.avgLatency}ms</span>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">ล่าสุด Port 1</span>
                    <span className={`text-sm font-bold font-mono ${selectedDevice.bgLatency1 ? (selectedDevice.bgLatency1 > 150 ? 'text-orange-500' : 'text-emerald-500') : 'text-slate-400'}`}>
                      {selectedDevice.bgLatency1 ? `${selectedDevice.bgLatency1}ms` : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">ล่าสุด Port 2</span>
                    <span className={`text-sm font-bold font-mono ${selectedDevice.bgLatency2 ? (selectedDevice.bgLatency2 > 150 ? 'text-orange-500' : 'text-emerald-500') : 'text-slate-400'}`}>
                      {selectedDevice.bgLatency2 ? `${selectedDevice.bgLatency2}ms` : '-'}
                    </span>
                  </div>
                </div>
              </div>
              
              {selectedDevice.bgLastScannedAt && (
                <div className="text-center pt-4">
                  <span className="text-[10px] font-bold text-slate-400">อัปเดตข้อมูลล่าสุด: {new Date(selectedDevice.bgLastScannedAt).toLocaleString('th-TH')}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
