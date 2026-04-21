"use client";

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { OjtForm } from '@/components/ojt-form';

export default function OjtDetailPage() {
  const params = useParams();
  const recordId = params.id as string;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="max-w-7xl mx-auto">

        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
          <Link href="/ojt" className="hover:text-foreground transition-colors">
            Entrenamiento
          </Link>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <span className="text-foreground font-medium">Editar Registro</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
            Registro de Entrenamiento
          </h1>
          <p className="text-muted-foreground text-sm">
            Todos los cambios en la tabla se guardan automáticamente al salir de cada campo
          </p>
        </div>

        <OjtForm recordId={recordId} />
      </div>
    </div>
  );
}
