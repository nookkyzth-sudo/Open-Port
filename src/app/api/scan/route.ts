import { NextRequest, NextResponse } from 'next/server';
import net from 'net';

export const maxDuration = 60; // Max duration for Vercel Hobby is 10s, Pro is 60s

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

export async function POST(req: NextRequest) {
    const data = await req.json();
    const targets = data.targets; // Array of { name, host, ports: [80, 443] }

    if (!Array.isArray(targets)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const sendEvent = (event: string, data: any) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };

            sendEvent('scan-started', { total: targets.length });

            const scanPromises = targets.map(async (target: any, idx: number) => {
                const portResults = await Promise.all(
                    target.ports.map((port: number) => scanPort(target.host, port))
                );

                const resultPayload = {
                    id: idx,
                    name: target.name,
                    host: target.host,
                    results: portResults
                };

                sendEvent('scan-item-result', resultPayload);
            });

            await Promise.all(scanPromises);
            sendEvent('scan-finished', { message: 'สแกนข้อมูลอุปกรณ์ทั้งหมดเสร็จสมบูรณ์' });
            controller.close();
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
}
