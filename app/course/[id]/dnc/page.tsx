"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileDown, Save, Users, ClipboardList, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { generateDncCoursePdf } from '@/lib/dnc-course-pdf';

type CourseData = {
    id: string;
    name: string;
    duration_hours: number | null;
    inst_interno: string | null;
    proveedor_sugerido: string | null;
    costo: number | null;
    fecha_programada: string | null;
    fecha_real: string | null;
    desarrollo_personal: boolean;
    habilidades_blandas: boolean;
    prevencion_riesgos: boolean;
    habilidades_tecnicas: boolean;
    comentario_dnc: string | null;
    training_year: number | null;
};

type Participant = {
    id: string;
    nombre: string;
    puesto: string;
    area: string;
    departamento: string | null;
};

export default function CourseDncPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const courseId = params.id as string;

    const [course, setCourse] = useState<CourseData | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const [form, setForm] = useState({
        inst_interno: '',
        proveedor_sugerido: '',
        costo: '',
        fecha_programada: '',
        fecha_real: '',
        duration_hours: '',
        desarrollo_personal: false,
        habilidades_blandas: false,
        prevencion_riesgos: false,
        habilidades_tecnicas: false,
        comentario_dnc: '',
    });

    const [searchName, setSearchName] = useState('');
    const [filterDept, setFilterDept] = useState('');

    useEffect(() => {
        fetchData();
    }, [courseId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: courseData, error: courseError } = await supabase
                .from('courses')
                .select(`
                    id, name, duration_hours,
                    inst_interno, proveedor_sugerido, costo,
                    fecha_programada, fecha_real,
                    desarrollo_personal, habilidades_blandas,
                    prevencion_riesgos, habilidades_tecnicas,
                    comentario_dnc,
                    training_years!year_id(year)
                `)
                .eq('id', courseId)
                .maybeSingle();

            if (courseError) throw courseError;
            if (!courseData) { router.push('/'); return; }

            const c: CourseData = {
                id: courseData.id,
                name: courseData.name,
                duration_hours: courseData.duration_hours,
                inst_interno: courseData.inst_interno,
                proveedor_sugerido: courseData.proveedor_sugerido,
                costo: courseData.costo,
                fecha_programada: courseData.fecha_programada,
                fecha_real: courseData.fecha_real,
                desarrollo_personal: courseData.desarrollo_personal ?? false,
                habilidades_blandas: courseData.habilidades_blandas ?? false,
                prevencion_riesgos: courseData.prevencion_riesgos ?? false,
                habilidades_tecnicas: courseData.habilidades_tecnicas ?? false,
                comentario_dnc: courseData.comentario_dnc,
                training_year: (courseData.training_years as any)?.year ?? null,
            };
            setCourse(c);

            setForm({
                inst_interno: c.inst_interno || '',
                proveedor_sugerido: c.proveedor_sugerido || '',
                costo: c.costo != null ? String(c.costo) : '',
                fecha_programada: c.fecha_programada || '',
                fecha_real: c.fecha_real || '',
                duration_hours: c.duration_hours != null ? String(c.duration_hours) : '',
                desarrollo_personal: c.desarrollo_personal,
                habilidades_blandas: c.habilidades_blandas,
                prevencion_riesgos: c.prevencion_riesgos,
                habilidades_tecnicas: c.habilidades_tecnicas,
                comentario_dnc: c.comentario_dnc || '',
            });

            const { data: pData, error: pError } = await supabase
                .from('course_participants')
                .select('employees!employee_id(id, nombre, puesto, area, departamentos!departamento_id(nombre_completo))')
                .eq('course_id', courseId)
                .order('employees(nombre)', { ascending: true });

            if (pError) throw pError;

            const parts: Participant[] = ((pData || [])
                .map((row: any) => {
                    const emp = row.employees;
                    if (!emp) return null;
                    return {
                        id: emp.id,
                        nombre: emp.nombre,
                        puesto: emp.puesto,
                        area: emp.area,
                        departamento: emp.departamentos?.nombre_completo ?? null,
                    };
                })
                .filter(Boolean) as Participant[])
                .sort((a: Participant, b: Participant) => a.nombre.localeCompare(b.nombre));

            setParticipants(parts);
        } catch (error: any) {
            console.error('Error fetching DNC data:', error);
            toast({
                title: 'Error',
                description: 'No se pudieron cargar los datos del DNC',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                inst_interno: form.inst_interno.trim() || null,
                proveedor_sugerido: form.proveedor_sugerido.trim() || null,
                costo: form.costo ? parseFloat(form.costo) : null,
                fecha_programada: form.fecha_programada || null,
                fecha_real: form.fecha_real || null,
                duration_hours: form.duration_hours ? parseFloat(form.duration_hours) : null,
                desarrollo_personal: form.desarrollo_personal,
                habilidades_blandas: form.habilidades_blandas,
                prevencion_riesgos: form.prevencion_riesgos,
                habilidades_tecnicas: form.habilidades_tecnicas,
                comentario_dnc: form.comentario_dnc.trim() || null,
            };

            const { error } = await supabase
                .from('courses')
                .update(payload)
                .eq('id', courseId);

            if (error) throw error;

            setCourse(prev => prev ? { ...prev, ...payload } : null);
            toast({ title: 'Éxito', description: 'Datos DNC guardados correctamente' });
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'No se pudieron guardar los datos',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportPdf = async () => {
        if (!course) return;
        setIsExporting(true);
        try {
            await generateDncCoursePdf({
                course: {
                    name: course.name,
                    inst_interno: form.inst_interno.trim() || null,
                    proveedor_sugerido: form.proveedor_sugerido.trim() || null,
                    costo: form.costo ? parseFloat(form.costo) : null,
                    desarrollo_personal: form.desarrollo_personal,
                    habilidades_blandas: form.habilidades_blandas,
                    prevencion_riesgos: form.prevencion_riesgos,
                    habilidades_tecnicas: form.habilidades_tecnicas,
                    fecha_programada: form.fecha_programada || null,
                    fecha_real: form.fecha_real || null,
                    duration_hours: form.duration_hours ? parseFloat(form.duration_hours) : null,
                    comentario_dnc: form.comentario_dnc.trim() || null,
                },
                participants: participants.map(p => ({
                    nombre: p.nombre,
                    puesto: p.puesto,
                    area: p.area,
                    departamento: p.departamento,
                })),
            });
        } catch (error: any) {
            toast({
                title: 'Error',
                description: 'No se pudo generar el PDF',
                variant: 'destructive',
            });
        } finally {
            setIsExporting(false);
        }
    };

    const uniqueDepts = Array.from(new Set(participants.map(p => p.departamento).filter(Boolean))).sort() as string[];

    const filteredParticipants = participants.filter(p => {
        const matchName = !searchName || p.nombre.toLowerCase().includes(searchName.toLowerCase());
        const matchDept = !filterDept || p.departamento === filterDept;
        return matchName && matchDept;
    });

    const checkboxFields = [
        { key: 'desarrollo_personal' as const, label: 'Desarrollo Personal y Académico' },
        { key: 'habilidades_blandas' as const, label: 'Habilidades Blandas' },
        { key: 'prevencion_riesgos' as const, label: 'Prevención de Riesgos y Accidentes' },
        { key: 'habilidades_tecnicas' as const, label: 'Habilidades Técnicas' },
    ];

    if (isLoading) {
        return (
            <div className="min-h-screen p-8 bg-slate-50">
                <div className="max-w-5xl mx-auto">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-muted rounded w-48" />
                        <div className="h-12 bg-muted rounded w-96" />
                        <div className="h-64 bg-muted rounded" />
                    </div>
                </div>
            </div>
        );
    }

    if (!course) return null;

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-5xl mx-auto">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.back()}
                            className="text-muted-foreground hover:text-foreground -ml-2"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Volver al curso
                        </Button>
                    </div>
                    <Button
                        onClick={handleExportPdf}
                        disabled={isExporting}
                        variant="outline"
                        className="flex items-center gap-2 border-[#192b52] text-[#192b52] hover:bg-[#192b52] hover:text-white"
                    >
                        <FileDown className="w-4 h-4" />
                        {isExporting ? 'Generando PDF...' : 'Exportar PDF'}
                    </Button>
                </div>

                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                            <ClipboardList className="w-5 h-5 text-[#2166be]" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-[#192b52]">{course.name}</h1>
                            <p className="text-muted-foreground text-sm">
                                DNC — Detección de Necesidades de Capacitación
                                {course.training_year && ` · ${course.training_year}`}
                            </p>
                        </div>
                    </div>
                </div>

                <Card className="border-none shadow-lg mb-8">
                    <CardHeader className="pb-4 border-b">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-semibold text-[#192b52]">
                                Datos DNC del Curso
                            </CardTitle>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-[#2166be] hover:bg-[#1a5299] text-white flex items-center gap-2"
                                size="sm"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Guardando...' : 'Guardar cambios'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                            <div className="space-y-1.5">
                                <Label htmlFor="dnc-inst-interno" className="text-sm font-medium">Inst. Interno</Label>
                                <Input
                                    id="dnc-inst-interno"
                                    type="text"
                                    placeholder="—"
                                    value={form.inst_interno}
                                    onChange={e => setForm(f => ({ ...f, inst_interno: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="dnc-proveedor" className="text-sm font-medium">Proveedor Sugerido</Label>
                                <Input
                                    id="dnc-proveedor"
                                    type="text"
                                    placeholder="—"
                                    value={form.proveedor_sugerido}
                                    onChange={e => setForm(f => ({ ...f, proveedor_sugerido: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="dnc-costo" className="text-sm font-medium">Costo</Label>
                                <Input
                                    id="dnc-costo"
                                    type="number"
                                    placeholder="0.00"
                                    value={form.costo}
                                    onChange={e => setForm(f => ({ ...f, costo: e.target.value }))}
                                    min="0"
                                    step="any"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="dnc-duration" className="text-sm font-medium">Duración (hrs)</Label>
                                <Input
                                    id="dnc-duration"
                                    type="number"
                                    placeholder="0"
                                    value={form.duration_hours}
                                    onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))}
                                    min="0"
                                    step="0.5"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="dnc-fecha-prog" className="text-sm font-medium">Fecha Programada</Label>
                                <Input
                                    id="dnc-fecha-prog"
                                    type="date"
                                    value={form.fecha_programada}
                                    onChange={e => setForm(f => ({ ...f, fecha_programada: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="dnc-fecha-real" className="text-sm font-medium">Fecha Real</Label>
                                <Input
                                    id="dnc-fecha-real"
                                    type="date"
                                    value={form.fecha_real}
                                    onChange={e => setForm(f => ({ ...f, fecha_real: e.target.value }))}
                                />
                            </div>

                            <div className="sm:col-span-2 space-y-2">
                                <Label className="text-sm font-medium">Tipo de Capacitación</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {checkboxFields.map(({ key, label }) => (
                                        <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={form[key]}
                                                onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                                                className="w-4 h-4 rounded border-gray-300 text-[#2166be] focus:ring-[#2166be]"
                                            />
                                            <span className="text-sm group-hover:text-[#2166be] transition-colors">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="sm:col-span-2 space-y-1.5">
                                <Label htmlFor="dnc-comentario" className="text-sm font-medium">Comentario</Label>
                                <textarea
                                    id="dnc-comentario"
                                    value={form.comentario_dnc}
                                    onChange={e => setForm(f => ({ ...f, comentario_dnc: e.target.value }))}
                                    placeholder="Observaciones adicionales..."
                                    rows={3}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg">
                    <CardHeader className="pb-4 border-b">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-100">
                                    <Users className="w-4 h-4 text-green-600" />
                                </div>
                                <CardTitle className="text-lg font-semibold text-[#192b52]">
                                    Participantes del Curso
                                </CardTitle>
                                <Badge variant="secondary">{participants.length}</Badge>
                            </div>
                        </div>

                        {participants.length > 0 && (
                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por nombre..."
                                        value={searchName}
                                        onChange={e => setSearchName(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                {uniqueDepts.length > 1 && (
                                    <select
                                        value={filterDept}
                                        onChange={e => setFilterDept(e.target.value)}
                                        className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2166be] min-w-[180px]"
                                    >
                                        <option value="">Todos los departamentos</option>
                                        {uniqueDepts.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}
                    </CardHeader>

                    <CardContent className="pt-4">
                        {participants.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                                <p className="text-muted-foreground text-sm">No hay participantes inscritos en este curso</p>
                            </div>
                        ) : filteredParticipants.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-muted-foreground text-sm">No se encontraron participantes con esos filtros</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-[#192b52]">Nombre</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-[#192b52]">Puesto</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-[#192b52]">Área</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-[#192b52]">Departamento</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredParticipants.map((p, i) => (
                                            <tr
                                                key={p.id}
                                                className={`border-b last:border-0 hover:bg-muted/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}
                                            >
                                                <td className="py-3 px-4 text-sm font-medium">{p.nombre}</td>
                                                <td className="py-3 px-4 text-sm text-muted-foreground">{p.puesto}</td>
                                                <td className="py-3 px-4 text-sm text-muted-foreground">{p.area}</td>
                                                <td className="py-3 px-4 text-sm text-muted-foreground">{p.departamento || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
