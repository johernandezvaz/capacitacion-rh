"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileBarChart2, Search, ExternalLink, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useTrainingYears } from '@/hooks/use-training-years';
import { fmtDate, STATUS_CONFIG } from '@/lib/detecciones-utils';

type CourseEntry = {
    id: string;
    name: string;
    participant_count: number;
};

type DetEntry = {
    id: string;
    nombre: string;
    color: string;
    status: string | null;
    inst_interno: string | null;
    proveedor_sugerido: string | null;
    costo: number | null;
    fecha_programada: string | null;
    fecha_real: string | null;
    duration_hours: number | null;
    desarrollo_personal: boolean;
    habilidades_blandas: boolean;
    prevencion_riesgos: boolean;
    habilidades_tecnicas: boolean;
    departamentos: string[];
    empleados: { id: string; nombre: string; puesto: string; departamento: string | null }[];
    employee_count: number;
};

const CHECK_FIELDS: { key: keyof DetEntry; label: string }[] = [
    { key: 'desarrollo_personal', label: 'Des. Personal' },
    { key: 'habilidades_blandas', label: 'Hab. Blandas' },
    { key: 'prevencion_riesgos', label: 'Prev. Riesgos' },
    { key: 'habilidades_tecnicas', label: 'Hab. Técnicas' },
];

export default function DncGeneralPage() {
    const router = useRouter();
    const { plantId } = useAuth();
    const { years, selectedYearId, setSelectedYearId } = useTrainingYears();

    const [courses, setCourses] = useState<CourseEntry[]>([]);
    const [detecciones, setDetecciones] = useState<DetEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchName, setSearchName] = useState('');

    useEffect(() => {
        if (plantId && selectedYearId) fetchData();
    }, [plantId, selectedYearId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: coursesData } = await supabase
                .from('courses')
                .select('id, name')
                .eq('plant_id', plantId)
                .eq('year_id', selectedYearId)
                .order('name');

            const courseIds = (coursesData || []).map((c: any) => c.id);
            let countMap: Record<string, number> = {};
            if (courseIds.length > 0) {
                const { data: cntData } = await supabase
                    .from('course_participants')
                    .select('course_id')
                    .in('course_id', courseIds);
                (cntData || []).forEach((r: any) => { countMap[r.course_id] = (countMap[r.course_id] || 0) + 1; });
            }
            setCourses((coursesData || []).map((c: any) => ({
                id: c.id, name: c.name, participant_count: countMap[c.id] || 0,
            })));

            const { data: detData } = await supabase
                .from('detecciones')
                .select('*')
                .eq('plant_id', plantId)
                .eq('year_id', selectedYearId)
                .order('nombre');

            if (!detData || detData.length === 0) { setDetecciones([]); setIsLoading(false); return; }

            const detIds = detData.map((d: any) => d.id);

            const { data: deptLinks } = await supabase
                .from('deteccion_departamentos')
                .select('deteccion_id, departamentos!departamento_id(nombre_completo, codigo)')
                .in('deteccion_id', detIds);

            const { data: empLinks } = await supabase
                .from('deteccion_empleados')
                .select('deteccion_id, employees!employee_id(id, nombre, puesto, departamentos!departamento_id(nombre_completo))')
                .in('deteccion_id', detIds);

            const deptMap: Record<string, string[]> = {};
            (deptLinks || []).forEach((r: any) => {
                const txt = r.departamentos?.nombre_completo;
                if (!txt) return;
                if (!deptMap[r.deteccion_id]) deptMap[r.deteccion_id] = [];
                deptMap[r.deteccion_id].push(txt);
            });

            const empMap: Record<string, DetEntry['empleados']> = {};
            (empLinks || []).forEach((r: any) => {
                const emp = r.employees;
                if (!emp) return;
                if (!empMap[r.deteccion_id]) empMap[r.deteccion_id] = [];
                empMap[r.deteccion_id].push({
                    id: emp.id, nombre: emp.nombre, puesto: emp.puesto,
                    departamento: emp.departamentos?.nombre_completo ?? null,
                });
            });

            setDetecciones(detData.map((d: any) => ({
                ...d,
                departamentos: deptMap[d.id] || [],
                empleados: empMap[d.id] || [],
                employee_count: (empMap[d.id] || []).length,
            })));
        } catch (err) {
            console.error('Error fetching DNC general:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredCourses = courses.filter(c => !searchName || c.name.toLowerCase().includes(searchName.toLowerCase()));
    const filteredDets = detecciones.filter(d => !searchName || d.nombre.toLowerCase().includes(searchName.toLowerCase()));

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 bg-slate-50">
            <div className="max-w-5xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 flex-shrink-0">
                            <FileBarChart2 className="w-6 h-6 text-[#2166be]" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-[#192b52]">DNC General</h1>
                            <p className="text-muted-foreground text-sm">Vista de cursos y detecciones del año</p>
                        </div>
                    </div>
                    {years.length > 0 && (
                        <select
                            value={selectedYearId}
                            onChange={e => setSelectedYearId(e.target.value)}
                            className="border border-gray-200 rounded-lg px-4 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2166be] w-fit"
                        >
                            {years.map(y => <option key={y.id} value={y.id}>{y.year}</option>)}
                        </select>
                    )}
                </div>

                <Card className="border-none shadow-md mb-6">
                    <CardContent className="pt-5 pb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="Buscar por nombre..." value={searchName}
                                onChange={e => setSearchName(e.target.value)} className="pl-9" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg mb-8">
                    <CardHeader className="pb-3 border-b">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">Cursos</CardTitle>
                            <Badge variant="secondary">{filteredCourses.length}</Badge>
                        </div>
                        <CardDescription>Haz clic en "Ver DNC" para ver y editar el DNC de cada curso</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {isLoading ? (
                            <div className="animate-pulse space-y-3 py-6">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded" />)}</div>
                        ) : filteredCourses.length === 0 ? (
                            <div className="text-center py-12">
                                <FileBarChart2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                                <p className="text-muted-foreground text-sm">{searchName ? 'Sin resultados' : 'No hay cursos para este año'}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-[#192b52]">Nombre del Curso</th>
                                            <th className="text-center py-3 px-4 text-sm font-semibold text-[#192b52]">Participantes</th>
                                            <th className="text-right py-3 px-4 text-sm font-semibold text-[#192b52]">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredCourses.map((c, i) => (
                                            <tr key={c.id} className={`border-b last:border-0 hover:bg-muted/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                                                <td className="py-3 px-4 text-sm font-medium">{c.name}</td>
                                                <td className="py-3 px-4 text-center"><Badge variant="secondary">{c.participant_count}</Badge></td>
                                                <td className="py-3 px-4 text-right">
                                                    <Button size="sm" variant="outline"
                                                        className="border-[#2166be] text-[#2166be] hover:bg-[#2166be] hover:text-white"
                                                        onClick={() => router.push(`/course/${c.id}/dnc`)}>
                                                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Ver DNC
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg">
                    <CardHeader className="pb-3 border-b">
                        <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">Detecciones</CardTitle>
                            <Badge variant="secondary">{filteredDets.length}</Badge>
                        </div>
                        <CardDescription>Detecciones de necesidades de capacitación del año seleccionado</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {isLoading ? (
                            <div className="animate-pulse space-y-3 py-6">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded" />)}</div>
                        ) : filteredDets.length === 0 ? (
                            <div className="text-center py-12">
                                <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                                <p className="text-muted-foreground text-sm">{searchName ? 'Sin resultados' : 'No hay detecciones para este año'}</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {filteredDets.map(det => {
                                    const statusCfg = det.status ? STATUS_CONFIG[det.status] : null;
                                    return (
                                        <div key={det.id} className="border rounded-lg overflow-hidden">
                                            <div className="flex items-start justify-between gap-3 p-4 bg-slate-50 border-b">
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <span className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ background: det.color }} />
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-sm text-[#192b52] break-words">{det.nombre}</p>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {det.departamentos.map((d, i) => (
                                                                <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>
                                                            ))}
                                                            {statusCfg && (
                                                                <Badge className={`text-xs ${statusCfg.bg}`}>{statusCfg.label}</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="outline"
                                                    className="border-[#2166be] text-[#2166be] hover:bg-[#2166be] hover:text-white flex-shrink-0"
                                                    onClick={() => router.push('/detecciones')}>
                                                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Ver
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4 text-xs border-b">
                                                <div><span className="text-muted-foreground">Inst. Interno:</span><br /><span className="font-medium">{det.inst_interno || '—'}</span></div>
                                                <div><span className="text-muted-foreground">Proveedor:</span><br /><span className="font-medium">{det.proveedor_sugerido || '—'}</span></div>
                                                <div><span className="text-muted-foreground">Costo:</span><br /><span className="font-medium">{det.costo != null ? `$${det.costo.toLocaleString('es-MX')}` : '—'}</span></div>
                                                <div><span className="text-muted-foreground">Duración:</span><br /><span className="font-medium">{det.duration_hours != null ? `${det.duration_hours}h` : '—'}</span></div>
                                                <div><span className="text-muted-foreground">F. Programada:</span><br /><span className="font-medium">{fmtDate(det.fecha_programada)}</span></div>
                                                <div><span className="text-muted-foreground">F. Real:</span><br /><span className="font-medium">{fmtDate(det.fecha_real)}</span></div>
                                                {CHECK_FIELDS.map(f => (
                                                    <div key={f.key}><span className="text-muted-foreground">{f.label}:</span><br />
                                                        <span className={`font-medium ${det[f.key] ? 'text-green-600' : 'text-muted-foreground'}`}>
                                                            {det[f.key] ? '✓' : '—'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            {det.empleados.length > 0 && (
                                                <div className="px-4 py-3">
                                                    <p className="text-xs font-semibold text-muted-foreground mb-2">EMPLEADOS ({det.employee_count})</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {det.empleados.map(emp => (
                                                            <div key={emp.id} className="bg-blue-50 border border-blue-100 rounded-md px-2 py-1 text-xs">
                                                                <span className="font-medium text-[#192b52]">{emp.nombre}</span>
                                                                <span className="text-muted-foreground ml-1">· {emp.puesto}</span>
                                                                {emp.departamento && <span className="text-muted-foreground ml-1">· {emp.departamento}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
