"use client";

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { OjtInstanceForm } from '@/components/ojt-instance-form';

export default function PublicOjtPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const [state, setState] = useState<{
    templateId: string | null;
    instanceId: string | null;
    plantId: string | null;
    notFound: boolean;
    loading: boolean;
  }>({ templateId: null, instanceId: null, plantId: null, notFound: false, loading: true });

  useEffect(() => {
    const load = async () => {
      // Paso 1: obtener la instancia por public_token
      const { data: instance, error } = await supabase
        .from('ojt_instances')
        .select('id, template_id')
        .eq('public_token', resolvedParams.token)
        .maybeSingle();

      if (error || !instance) {
        setState({ templateId: null, instanceId: null, plantId: null, notFound: true, loading: false });
        return;
      }

      // Paso 2: obtener plant_id desde ojt_records
      const { data: record } = await supabase
        .from('ojt_records')
        .select('plant_id')
        .eq('id', instance.template_id)
        .maybeSingle();

      setState({
        templateId: instance.template_id,
        instanceId: instance.id,
        plantId: record?.plant_id ?? null,
        notFound: false,
        loading: false,
      });
    };

    load();
  }, [resolvedParams.token]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-border rounded-xl shadow-sm p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-10 h-10 border-4 border-[#2166be] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Cargando entrenamiento...</p>
        </div>
      </div>
    );
  }

  if (state.notFound || !state.instanceId || !state.templateId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-border rounded-xl shadow-sm p-8 max-w-sm w-full text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-semibold">Enlace no válido</h1>
          <p className="text-muted-foreground text-sm">
            Este enlace no existe o ha expirado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1600px] mx-auto">
        <OjtInstanceForm
          instanceId={state.instanceId}
          templateId={state.templateId}
          plantId={state.plantId}
          isPublic={true}
        />
      </div>
    </div>
  );
}
