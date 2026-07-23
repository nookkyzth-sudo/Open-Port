import { NextRequest, NextResponse } from 'next/server';
import net from 'net';
import prisma from '@/lib/prisma';

export const maxDuration = 60; // Max duration for Vercel Hobby is 10s, Pro is 60s
export const dynamic = 'force-dynamic';

function scanPort(host: string, port: number, timeout = 2000): Promise<{ port: number, status: string, latency: number | null }> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let status = 'CLOSED/TIMEOUT';
        let latency: number | null = null;
        const startTime = Date.now();
        
        socket.setTimeout(timeout);
        
        socket.on('connect', () => {
            status = 'CONNECTED';
            latency = Date.now() - startTime;
            socket.destroy();
        });
        
        socket.on('timeout', () => {
            socket.destroy();
        });
        
        socket.on('error', () => {
            socket.destroy();
        });
        
        socket.on('close', () => {
            resolve({ port, status, latency });
        });
        
        socket.connect(port, host);
    });
}

async function sendLineNotify(token: string, message: string) {
    try {
        const response = await fetch('https://notify-api.line.me/api/notify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${token}`
            },
            body: new URLSearchParams({ message }).toString()
        });
        if (!response.ok) {
            console.error('LINE Notify Error:', await response.text());
        }
    } catch (e) {
        console.error('Failed to send LINE Notify:', e);
    }
}

export async function GET(req: NextRequest) {
    try {
        const [devices, config] = await Promise.all([
            prisma.device.findMany({
                where: {
                    host: { not: '' },
                    ports: { not: '' }
                }
            }),
            prisma.config.findUnique({ where: { id: 'app-data' } })
        ]);

        if (devices.length === 0) {
            return NextResponse.json({ success: true, message: 'No devices to scan.' });
        }

        const lineToken = config?.lineNotifyToken;

        const scanPromises = devices.map(async (device) => {
            const portsStr = device.ports.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0 && p <= 65535);
            if (portsStr.length === 0) return;

            // Take up to 2 ports
            const portsToScan = portsStr.slice(0, 2);
            
            const results = await Promise.all(
                portsToScan.map(p => scanPort(device.host, p))
            );

            const bgPort1Status = results[0]?.status || '-';
            const bgLatency1 = results[0]?.latency ?? null;
            const bgPort2Status = results[1] ? results[1].status : '-';
            const bgLatency2 = results[1] ? results[1].latency : null;
            
            // Check if BOTH are offline (or if only 1 port exists, it must be offline)
            let isOffline = false;
            if (portsToScan.length === 1) {
                isOffline = bgPort1Status !== 'CONNECTED';
            } else if (portsToScan.length >= 2) {
                isOffline = bgPort1Status !== 'CONNECTED' && bgPort2Status !== 'CONNECTED';
            }

            const wasOffline = device.isOffline;
            
            // Database Update
            await prisma.device.update({
                where: { id: device.id },
                data: {
                    bgPort1Status,
                    bgPort2Status,
                    bgLatency1,
                    bgLatency2,
                    isOffline,
                    bgLastScannedAt: new Date()
                }
            });

            // Save latency history for chart (only when at least one port responded)
            if (bgLatency1 !== null || bgLatency2 !== null) {
                await prisma.latencyHistory.create({
                    data: {
                        deviceId: device.id,
                        port1Lat: bgLatency1,
                        port2Lat: bgLatency2,
                    }
                });
            }

            // State transition logic
            if (!wasOffline && isOffline) {
                // Went offline
                await prisma.deviceLog.create({
                    data: {
                        deviceId: device.id,
                        event: 'OFFLINE',
                        message: `เชื่อมต่อไม่ได้ (Port: ${device.ports})`
                    }
                });
                if (lineToken) {
                    await sendLineNotify(lineToken, `\n🔴 [แจ้งเตือน] อุปกรณ์ขาดการเชื่อมต่อ\nชื่อ: ${device.name}\nIP: ${device.host}\nพอร์ต: ${device.ports}`);
                }
            } else if (wasOffline && !isOffline) {
                // Came back online
                await prisma.deviceLog.create({
                    data: {
                        deviceId: device.id,
                        event: 'ONLINE',
                        message: `กลับมาเชื่อมต่อได้แล้ว`
                    }
                });
                if (lineToken) {
                    await sendLineNotify(lineToken, `\n🟢 [กลับมาปกติ] อุปกรณ์เชื่อมต่อได้แล้ว\nชื่อ: ${device.name}\nIP: ${device.host}`);
                }
            }
        });

        await Promise.all(scanPromises);

        // Cleanup: delete LatencyHistory older than 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        await prisma.latencyHistory.deleteMany({
            where: { createdAt: { lt: sevenDaysAgo } }
        });

        return NextResponse.json({ success: true, message: `Scanned ${devices.length} devices.` });
    } catch (error: any) {
        console.error('Cron scan error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
