"use client";

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function PublicOjtPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const resolveToken = async () => {
      const { data, error } = await supabase
        .from('ojt_instances')
        .select('id, template_id')
        .eq('id', resolvedParams.token)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        return;
      }

      router.replace(`/ojt/${data.template_id}/instancias/${data.id}`);
    };

    resolveToken();
  }, [resolvedParams.token, router]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-border rounded-xl shadow-sm p-8 max-w-sm w-full text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-semibold text-foreground">Enlace no válido</h1>
          <p className="text-muted-foreground text-sm">
            Este enlace no existe o ha expirado. Solicita un nuevo enlace al administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-border rounded-xl shadow-sm p-8 max-w-sm w-full text-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#2166be] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Cargando entrenamiento...</p>
      </div>
    </div>
  );
}
