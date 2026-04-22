"use client";

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Users } from 'lucide-react';
import { OjtForm } from '@/components/ojt-form';
import { Button } from '@/components/ui/button';

export default function OjtDetailPage() {
  const params = useParams();
  const recordId = params.id as string;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
          <Link href="/ojt" className="hover:text-foreground transition-colors">Entrenamiento</Link>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <span className="text-foreground font-medium">Editar Plantilla</span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Plantilla de Entrenamiento</h1>
            <p className="text-muted-foreground text-sm">Los cambios en la tabla se guardan automáticamente al salir de cada campo</p>
          </div>
          <Link href={`/ojt/${recordId}/instancias`}>
            <Button variant="outline" className="gap-2 text-[#2166be] border-[#2166be] hover:bg-[#2166be]/5 shrink-0">
              <Users className="w-4 h-4" />
              Ver instancias
            </Button>
          </Link>
        </div>

        <OjtForm recordId={recordId} />
      </div>
    </div>
  );
}
