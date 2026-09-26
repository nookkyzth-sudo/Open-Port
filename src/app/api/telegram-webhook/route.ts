import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function sendTelegramMessage(botToken: string, chatId: number | string, text: string) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        })
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const message = body.message;

        if (!message || !message.text) {
            return NextResponse.json({ success: true });
        }

        const chatId = message.chat.id;
        const text = message.text.trim();

        // Check if command is /status
        if (text === '/status' || text === '/status@openport_cctv_bot') {
            const config = await prisma.config.findUnique({ where: { id: 'app-data' } });
            const botToken = config?.telegramBotToken;

            if (!botToken) {
                return NextResponse.json({ success: true, error: 'Bot token not configured' });
            }

            // Fetch devices
            const devices = await prisma.device.findMany({
                where: {
                    host: { not: '' },
                    ports: { not: '' }
                }
            });

            const total = devices.length;
            const offlineDevices = devices.filter(d => d.isOffline);
            const online = total - offlineDevices.length;
            const offline = offlineDevices.length;

            let reply = `📊 <b>สรุปสถานะอุปกรณ์ปัจจุบัน</b>\n`;
            reply += `---------------------------------\n`;
            reply += `💻 ทั้งหมด: ${total} อุปกรณ์\n`;
            reply += `🟢 ออนไลน์: ${online} อุปกรณ์\n`;
            reply += `🔴 ออฟไลน์: ${offline} อุปกรณ์\n\n`;

            if (offline > 0) {
                reply += `⚠️ <b>รายชื่ออุปกรณ์ที่ออฟไลน์:</b>\n`;
                offlineDevices.forEach((d, index) => {
                    reply += `${index + 1}. ${d.name || 'ไม่ระบุชื่อ'} (IP: ${d.host})\n`;
                });
            } else {
                reply += `✅ <b>สถานะปกติ ทุกอุปกรณ์ออนไลน์</b>`;
            }

            await sendTelegramMessage(botToken, chatId, reply);
        } else if (text === '/list' || text === '/list@openport_cctv_bot') {
            const config = await prisma.config.findUnique({ where: { id: 'app-data' } });
            const botToken = config?.telegramBotToken;

            if (!botToken) {
                return NextResponse.json({ success: true, error: 'Bot token not configured' });
            }

            // Fetch devices
            const devices = await prisma.device.findMany({
                where: {
                    host: { not: '' },
                    ports: { not: '' }
                },
                orderBy: { pageId: 'asc' }
            });

            if (devices.length === 0) {
                await sendTelegramMessage(botToken, chatId, '📭 ยังไม่มีข้อมูลอุปกรณ์ในระบบ');
                return NextResponse.json({ success: true });
            }

            let reply = `📋 <b>รายชื่ออุปกรณ์ทั้งหมด (${devices.length})</b>\n\n`;
            
            // Chunk messages to avoid Telegram 4096 char limit
            for (let i = 0; i < devices.length; i++) {
                const d = devices[i];
                const statusIcon = d.isOffline ? '🔴' : '🟢';
                const line = `${statusIcon} ${i + 1}. <b>${d.name || 'ไม่ระบุ'}</b>\n   IP: <code>${d.host}</code>\n   Port: ${d.ports}\n\n`;
                
                if (reply.length + line.length > 3500) {
                    await sendTelegramMessage(botToken, chatId, reply);
                    reply = '';
                }
                reply += line;
            }

            if (reply.trim().length > 0) {
                await sendTelegramMessage(botToken, chatId, reply);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Telegram Webhook Error:', error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
