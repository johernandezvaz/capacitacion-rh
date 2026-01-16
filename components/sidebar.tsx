"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Calendar, BarChart3, Users } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      name: 'Años y Cursos',
      href: '/',
      icon: Calendar,
      active: pathname === '/' || pathname.startsWith('/year') || pathname.startsWith('/course'),
    },
    {
      name: 'Empleados',
      href: '/employees',
      icon: Users,
      active: pathname === '/employees' || pathname.startsWith('/employee'),
    },
    {
      name: 'Reportes',
      href: '/reports',
      icon: BarChart3,
      active: pathname === '/reports',
      disabled: true,
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#192b52] flex flex-col">
      <div className="p-6 border-b border-white/10">
        <Image
          src="/safe-demo_logo-blc-Photoroom.png"
          alt="Safe Demo Logo"
          width={180}
          height={60}
          className="w-auto h-12"
          priority
        />
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.name}>
                <Link
                  href={item.disabled ? '#' : item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-all duration-200
                    ${item.active
                      ? 'bg-[#2166be] text-white shadow-md'
                      : item.disabled
                        ? 'text-white/40 cursor-not-allowed'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                    }
                  `}
                  onClick={(e) => item.disabled && e.preventDefault()}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/10">
        <p className="text-white/60 text-sm text-center">
          Sistema de Capacitaciones
        </p>
      </div>
    </aside>
  );
}
