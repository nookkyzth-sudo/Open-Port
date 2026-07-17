import { NextRequest, NextResponse } from 'next/server';
import net from 'net';
import prisma from '@/lib/prisma';

export const maxDuration = 60; // Max duration for Vercel Hobby is 10s, Pro is 60s
export const dynamic = 'force-dynamic';

function scanPort(host: string, port: number, timeout = 2000): Promise<{ port: number, status: string }> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let status = 'CLOSED/TIMEOUT';
        
        socket.setTimeout(timeout);
        
        socket.on('connect', () => {
            status = 'CONNECTED';
            socket.destroy();
        });
        
        socket.on('timeout', () => {
            socket.destroy();
        });
        
        socket.on('error', () => {
            socket.destroy();
        });
        
        socket.on('close', () => {
            resolve({ port, status });
        });
        
        socket.connect(port, host);
    });
}

export async function GET(req: NextRequest) {
    try {
        const devices = await prisma.device.findMany({
            where: {
                host: { not: '' },
                ports: { not: '' }
            }
        });

        if (devices.length === 0) {
            return NextResponse.json({ success: true, message: 'No devices to scan.' });
        }

        const scanPromises = devices.map(async (device) => {
            const portsStr = device.ports.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p > 0 && p <= 65535);
            if (portsStr.length === 0) return;

            // Take up to 2 ports
            const portsToScan = portsStr.slice(0, 2);
            
            const results = await Promise.all(
                portsToScan.map(p => scanPort(device.host, p))
            );

            const bgPort1Status = results[0]?.status || '-';
            const bgPort2Status = results[1] ? results[1].status : '-';
            
            // Check if BOTH are offline (or if only 1 port exists, it must be offline)
            let isOffline = false;
            if (portsToScan.length === 1) {
                isOffline = bgPort1Status !== 'CONNECTED';
            } else if (portsToScan.length >= 2) {
                isOffline = bgPort1Status !== 'CONNECTED' && bgPort2Status !== 'CONNECTED';
            }

            await prisma.device.update({
                where: { id: device.id },
                data: {
                    bgPort1Status,
                    bgPort2Status,
                    isOffline,
                    bgLastScannedAt: new Date()
                }
            });
        });

        await Promise.all(scanPromises);

        return NextResponse.json({ success: true, message: `Scanned ${devices.length} devices.` });
    } catch (error: any) {
        console.error('Cron scan error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
