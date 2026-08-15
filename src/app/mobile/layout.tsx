'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Timer, BarChart2, Activity, User } from 'lucide-react'

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const navItems = [
    { href: '/mobile', icon: Home, label: 'หน้าแรก' },
    { href: '/mobile/monitor', icon: Timer, label: 'ทดสอบ' },
    { href: '/mobile/dashboard', icon: BarChart2, label: 'สถิติ' },
    { href: '/mobile/network-map', icon: Activity, label: 'แผนที่' },
    { href: '/profile', icon: User, label: 'โปรไฟล์' },
  ]

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Top Status Bar (Optional, safe area for Notch) */}
      <div className="h-safe-top bg-indigo-700 w-full" />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 pb-safe-bottom z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/mobile' && pathname.startsWith(item.href))
          const Icon = item.icon
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                isActive 
                  ? 'text-indigo-600 dark:text-indigo-400' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1.5 rounded-full transition-all ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}>
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[9px] font-medium ${isActive ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
