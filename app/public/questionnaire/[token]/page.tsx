"use client";

import { useEffect } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function PublicQuestionnairePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  useEffect(() => {
    const resolveToken = async () => {
      const { data, error } = await supabase
        .from('questionnaires')
        .select('id, type')
        .eq('id', resolvedParams.token)
        .maybeSingle();

      if (error || !data) {
        return;
      }

      if (data.type === 'hot') {
        router.replace(`/questionnaire/hot/${data.id}`);
      } else if (data.type === 'cold') {
        router.replace(`/questionnaire/cold/${data.id}`);
      }
    };

    resolveToken();
  }, [resolvedParams.token, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-border rounded-xl shadow-sm p-8 max-w-sm w-full text-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#2166be] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Cargando cuestionario...</p>
      </div>
    </div>
  );
}
