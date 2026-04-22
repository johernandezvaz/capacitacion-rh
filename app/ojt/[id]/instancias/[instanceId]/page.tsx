"use client";

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { OjtInstanceForm } from '@/components/ojt-instance-form';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function OjtInstancePage() {
  const params = useParams();
  const templateId = params.id as string;
  const instanceId = params.instanceId as string;
  const [templateTitle, setTemplateTitle] = useState('');

  useEffect(() => {
    supabase.from('ojt_records').select('titulo').eq('id', templateId).maybeSingle()
      .then(({ data }) => setTemplateTitle(data?.titulo ?? 'Plantilla'));
  }, [templateId]);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
          <Link href="/ojt" className="hover:text-foreground transition-colors">Entrenamiento</Link>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <Link href={`/ojt/${templateId}/instancias`} className="hover:text-foreground transition-colors">
            {templateTitle}
          </Link>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <span className="text-foreground font-medium">Instancia</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
            Registro de Entrenamiento en el Puesto
          </h1>
          <p className="text-muted-foreground text-sm">
            Los cambios en la tabla se guardan automáticamente al salir de cada campo
          </p>
        </div>

        <OjtInstanceForm instanceId={instanceId} templateId={templateId} />
      </div>
    </div>
  );
}
