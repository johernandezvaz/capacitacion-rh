import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const COURSE_COLOR = '#4A249D';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const employeeId = resolvedParams.id;

        const empRes = await pool.query(
            `SELECT nombre, puesto FROM employees WHERE id = $1`,
            [employeeId]
        );

        if (empRes.rowCount === 0) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        }

        const empData = empRes.rows[0];

        const coursesRes = await pool.query(
            `SELECT c.name, c.inst_interno, c.inst_externo, c.proveedor_sugerido, c.costo,
                    c.desarrollo_personal, c.habilidades_blandas, c.prevencion_riesgos,
                    c.habilidades_tecnicas, c.fecha_programada, c.fecha_real, c.duration_hours
             FROM course_participants cp
             JOIN courses c ON cp.course_id = c.id
             WHERE cp.employee_id = $1`,
            [employeeId]
        );

        const courseRows = coursesRes.rows.map(r => ({
            tipo: 'curso' as const,
            nombre: r.name || '—',
            color: COURSE_COLOR,
            inst_interno: !!r.inst_interno,
            inst_externo: !!r.inst_externo,
            proveedor_sugerido: r.proveedor_sugerido ?? null,
            costo: r.costo != null ? Number(r.costo) : null,
            desarrollo_personal: !!r.desarrollo_personal,
            habilidades_blandas: !!r.habilidades_blandas,
            prevencion_riesgos: !!r.prevencion_riesgos,
            habilidades_tecnicas: !!r.habilidades_tecnicas,
            fecha_programada: r.fecha_programada ?? null,
            fecha_real: r.fecha_real ?? null,
            duration_hours: r.duration_hours != null ? Number(r.duration_hours) : null,
        }));

        const detRes = await pool.query(
            `SELECT d.id, d.nombre, d.color, d.inst_interno, d.inst_externo, d.proveedor_sugerido,
                    d.costo, d.duration_hours, d.desarrollo_personal, d.habilidades_blandas,
                    d.prevencion_riesgos, d.habilidades_tecnicas, d.fecha_programada, d.fecha_real
             FROM deteccion_empleados de
             JOIN detecciones d ON de.deteccion_id = d.id
             WHERE de.employee_id = $1`,
            [employeeId]
        );

        const detRows = detRes.rows.map(d => ({
            tipo: 'deteccion' as const,
            nombre: d.nombre || '—',
            color: d.color || '#2166be',
            inst_interno: !!d.inst_interno,
            inst_externo: !!d.inst_externo,
            proveedor_sugerido: d.proveedor_sugerido ?? null,
            costo: d.costo != null ? Number(d.costo) : null,
            desarrollo_personal: !!d.desarrollo_personal,
            habilidades_blandas: !!d.habilidades_blandas,
            prevencion_riesgos: !!d.prevencion_riesgos,
            habilidades_tecnicas: !!d.habilidades_tecnicas,
            fecha_programada: d.fecha_programada ?? null,
            fecha_real: d.fecha_real ?? null,
            duration_hours: d.duration_hours != null ? Number(d.duration_hours) : null,
        }));

        const combined = [...courseRows, ...detRows].sort((a, b) => {
            if (!a.fecha_programada && !b.fecha_programada) return 0;
            if (!a.fecha_programada) return 1;
            if (!b.fecha_programada) return -1;
            return a.fecha_programada.localeCompare(b.fecha_programada);
        });

        return NextResponse.json({
            nombre: empData.nombre,
            puesto: empData.puesto,
            rows: combined,
        });
    } catch (error: any) {
        console.error('Error in GET /employees/[id]/dnc/data:', error);
        return NextResponse.json(
            { error: error?.message || 'Error al obtener DNC de empleado' },
            { status: 500 }
        );
    }
}
