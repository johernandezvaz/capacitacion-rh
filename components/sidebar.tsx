"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Calendar, BarChart3, Users, Menu, X, ClipboardList, LogOut, Building2, CalendarDays, FileBarChart2, ClipboardCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

export function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { user, plantName, signOut } = useAuth();

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
    },
    {
      name: 'Entrenamiento',
      href: '/ojt',
      icon: ClipboardList,
      active: pathname.startsWith('/ojt'),
    },
    {
      name: 'Calendario de Cursos',
      href: '/dnc',
      icon: CalendarDays,
      active: pathname === '/dnc',
    },
    {
      name: 'DNC General',
      href: '/dnc/general',
      icon: FileBarChart2,
      active: pathname === '/dnc/general',
    },
    {
      name: 'Detecciones',
      href: '/detecciones',
      icon: ClipboardCheck,
      active: pathname === '/detecciones' || pathname.startsWith('/detecciones/'),
    },
  ];

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const displayName = user?.user_metadata?.name || user?.email || '';

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#192b52] text-white shadow-lg"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-screen w-64 bg-[#192b52] flex flex-col z-40
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
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

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-all duration-200
                      ${item.active
                        ? 'bg-[#2166be] text-white shadow-md'
                        : 'text-white/80 hover:bg-white/5 hover:text-white'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          {plantName && (
            <div className="flex items-center gap-2 px-1">
              <Building2 className="w-4 h-4 text-white/50 flex-shrink-0" />
              <span className="text-white/70 text-xs truncate">{plantName}</span>
            </div>
          )}
          {displayName && (
            <div className="px-1">
              <p className="text-white/90 text-sm font-medium truncate">{displayName}</p>
            </div>
          )}
          <button
            onClick={() => { setIsOpen(false); signOut(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
