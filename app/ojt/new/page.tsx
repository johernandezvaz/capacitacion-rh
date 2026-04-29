"use client";

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { OjtForm } from '@/components/ojt-form';
import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/contexts/auth-context';

export default function OjtNewPage() {
  const { plantId } = useAuth();

  return (
    <ProtectedRoute>
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
          <Link href="/ojt" className="hover:text-foreground transition-colors">
            Entrenamiento
          </Link>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <span className="text-foreground font-medium">Nueva Plantilla</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
            Nueva Plantilla de Entrenamiento
          </h1>
          <p className="text-muted-foreground text-sm">
            Completa los datos generales y guarda para crear la plantilla
          </p>
        </div>

        <OjtForm recordId={null} plantId={plantId || ''} />
      </div>
    </div>
    </ProtectedRoute>
  );
}
