"use client";

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Link as LinkIcon } from 'lucide-react';
import { OjtInstanceForm } from '@/components/ojt-instance-form';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function OjtInstancePage() {
  const params = useParams();
  const templateId = params.id as string;
  const instanceId = params.instanceId as string;
  const [templateTitle, setTemplateTitle] = useState('');
  const [publicToken, setPublicToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('ojt_records').select('titulo').eq('id', templateId).maybeSingle()
      .then(({ data }) => setTemplateTitle(data?.titulo ?? 'Plantilla'));
    
    supabase.from('ojt_instances').select('public_token').eq('id', instanceId).maybeSingle()
      .then(({ data }) => {
        if (data?.public_token) {
          setPublicToken(data.public_token);
        }
      });
  }, [templateId, instanceId]);

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

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
              Registro de Entrenamiento en el Puesto
            </h1>
            <p className="text-muted-foreground text-sm">
              Los cambios en la tabla se guardan automáticamente al salir de cada campo
            </p>
          </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-[#2166be] border-[#2166be] hover:bg-[#2166be]/5 shrink-0"
              onClick={() => {
                if (!publicToken) {
                  toast.error('No se pudo obtener el enlace público');
                  return;
                }
                const url = `${window.location.origin}/public/ojt/${publicToken}`;
                navigator.clipboard.writeText(url);
                toast.success('Enlace copiado al portapapeles');
              }}
              title="Copiar enlace público de esta instancia"
            >
              <LinkIcon className="w-4 h-4" />
              Compartir
            </Button>
        </div>

        <OjtInstanceForm instanceId={instanceId} templateId={templateId} />
      </div>
    </div>
  );
}
