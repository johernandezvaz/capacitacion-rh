"use client";

import { use, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const HotPage = dynamic(() => import('@/app/questionnaire/hot/[id]/page'), { ssr: false });
const ColdPage = dynamic(() => import('@/app/questionnaire/cold/[id]/page'), { ssr: false });

export default function PublicQuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const [state, setState] = useState<{
    type: 'hot' | 'cold' | null;
    id: string | null;
    notFound: boolean;
    loading: boolean;
  }>({ type: null, id: null, notFound: false, loading: true });

  useEffect(() => {
    fetch(`/public/questionnaire/${resolvedParams.token}/data`)
      .then(async (res) => {
        if (!res.ok) {
          setState({ type: null, id: null, notFound: true, loading: false });
          return;
        }
        const data = await res.json();
        setState({ type: data.type as 'hot' | 'cold', id: data.id, notFound: false, loading: false });
      })
      .catch((err) => {
        console.error('[PublicQuestionnairePage] Error loading data:', err);
        setState({ type: null, id: null, notFound: true, loading: false });
      });
  }, [resolvedParams.token]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-border rounded-xl shadow-sm p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-10 h-10 border-4 border-[#2166be] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Cargando cuestionario...</p>
        </div>
      </div>
    );
  }

  if (state.notFound || !state.id || !state.type) {
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

  const resolvedId = state.id;

  if (state.type === 'hot') {
    return <HotPage params={Promise.resolve({ id: resolvedId })} apiBasePath="/public/questionnaire/hot" />;
  }
  return <ColdPage params={Promise.resolve({ id: resolvedId })} apiBasePath="/public/questionnaire/cold" />;
}
