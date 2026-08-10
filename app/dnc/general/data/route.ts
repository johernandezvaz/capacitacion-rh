import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const plantId = searchParams.get('plant_id');
        const yearId = searchParams.get('year_id');

        if (!plantId || !yearId) {
            return NextResponse.json({ courseItems: [], detItems: [] });
        }

        const coursesRes = await pool.query(
            `SELECT id, name, date, fecha_programada, fecha_real, inst_interno, inst_externo, proveedor_sugerido, costo, duration_hours, desarrollo_personal, habilidades_blandas, prevencion_riesgos, habilidades_tecnicas, deteccion_id
             FROM courses
             WHERE plant_id = $1 AND year_id = $2
             ORDER BY date ASC NULLS LAST`,
            [plantId, yearId]
        );

        const coursesRaw = coursesRes.rows;
        const courseIds = coursesRaw.map(c => c.id);

        let partMap: Record<string, { nombre: string; puesto: string }[]> = {};
        if (courseIds.length > 0) {
            const partRes = await pool.query(
                `SELECT cp.course_id, e.nombre, e.puesto
                 FROM course_participants cp
                 JOIN employees e ON cp.employee_id = e.id
                 WHERE cp.course_id = ANY($1::uuid[])`,
                [courseIds]
            );

            partRes.rows.forEach(r => {
                if (!r.nombre) return;
                if (!partMap[r.course_id]) partMap[r.course_id] = [];
                partMap[r.course_id].push({ nombre: r.nombre, puesto: r.puesto || '' });
            });
        }

        const courseItems = coursesRaw.map(c => ({
            _type: 'course' as const,
            _sortDate: c.date || c.fecha_programada || c.fecha_real || '9999-12-31',
            id: c.id,
            name: c.name,
            date: c.date ?? null,
            fecha_programada: c.fecha_programada ?? null,
            fecha_real: c.fecha_real ?? null,
            inst_interno: !!c.inst_interno,
            inst_externo: !!c.inst_externo,
            proveedor_sugerido: c.proveedor_sugerido ?? null,
            costo: c.costo != null ? Number(c.costo) : null,
            duration_hours: c.duration_hours != null ? Number(c.duration_hours) : null,
            desarrollo_personal: !!c.desarrollo_personal,
            habilidades_blandas: !!c.habilidades_blandas,
            prevencion_riesgos: !!c.prevencion_riesgos,
            habilidades_tecnicas: !!c.habilidades_tecnicas,
            deteccion_id: c.deteccion_id ?? null,
            empleados: partMap[c.id] || [],
        }));

        const linkedIds = coursesRaw
            .map(c => c.deteccion_id)
            .filter(Boolean);

        let detQuery = `SELECT id, nombre, color, fecha_programada, fecha_real, inst_interno, inst_externo, proveedor_sugerido, costo, duration_hours, desarrollo_personal, habilidades_blandas, prevencion_riesgos, habilidades_tecnicas
                        FROM detecciones
                        WHERE plant_id = $1 AND year_id = $2`;
        const detParams: any[] = [plantId, yearId];

        if (linkedIds.length > 0) {
            detParams.push(linkedIds);
            detQuery += ` AND NOT (id = ANY($3::uuid[]))`;
        }

        detQuery += ` ORDER BY fecha_programada ASC NULLS LAST`;

        const detRes = await pool.query(detQuery, detParams);
        const detsRaw = detRes.rows;

        let empMap: Record<string, { nombre: string; puesto: string }[]> = {};
        if (detsRaw.length > 0) {
            const detIds = detsRaw.map(d => d.id);
            const empRes = await pool.query(
                `SELECT de.deteccion_id, e.nombre, e.puesto
                 FROM deteccion_empleados de
                 JOIN employees e ON de.employee_id = e.id
                 WHERE de.deteccion_id = ANY($1::uuid[])`,
                [detIds]
            );

            empRes.rows.forEach(r => {
                if (!r.nombre) return;
                if (!empMap[r.deteccion_id]) empMap[r.deteccion_id] = [];
                empMap[r.deteccion_id].push({ nombre: r.nombre, puesto: r.puesto || '' });
            });
        }

        const detItems = detsRaw.map(d => ({
            _type: 'deteccion' as const,
            _sortDate: d.fecha_real || d.fecha_programada || '9999-12-31',
            id: d.id,
            nombre: d.nombre,
            color: d.color || '#2166be',
            fecha_programada: d.fecha_programada ?? null,
            fecha_real: d.fecha_real ?? null,
            inst_interno: !!d.inst_interno,
            inst_externo: !!d.inst_externo,
            proveedor_sugerido: d.proveedor_sugerido ?? null,
            costo: d.costo != null ? Number(d.costo) : null,
            duration_hours: d.duration_hours != null ? Number(d.duration_hours) : null,
            desarrollo_personal: !!d.desarrollo_personal,
            habilidades_blandas: !!d.habilidades_blandas,
            prevencion_riesgos: !!d.prevencion_riesgos,
            habilidades_tecnicas: !!d.habilidades_tecnicas,
            empleados: empMap[d.id] || [],
        }));

        return NextResponse.json({
            courseItems,
            detItems,
        });
    } catch (error: any) {
        console.error('Error in GET /dnc/general/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener reporte general DNC' },
            { status: 500 }
        );
    }
}
