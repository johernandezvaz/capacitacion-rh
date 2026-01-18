import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { AttendanceListPDF } from '@/components/attendance-list-pdf';
import { supabase } from '@/lib/supabase';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const courseId = resolvedParams.id;

        const { data: courseData, error: courseError } = await supabase
            .from('courses')
            .select('name, date, duration_hours')
            .eq('id', courseId)
            .maybeSingle();

        if (courseError) {
            console.error('Error fetching course:', courseError);
            return NextResponse.json(
                { error: 'Error al obtener el curso', details: courseError.message },
                { status: 500 }
            );
        }

        if (!courseData) {
            return NextResponse.json(
                { error: 'Curso no encontrado' },
                { status: 404 }
            );
        }

        const { data: participantsData, error: participantsError } = await supabase
            .from('course_participants')
            .select(`
        employee:employees(
          employee_number,
          nombre,
          area,
          puesto
        )
      `)
            .eq('course_id', courseId);

        if (participantsError) {
            console.error('Error fetching participants:', participantsError);
            return NextResponse.json(
                { error: 'Error al obtener participantes', details: participantsError.message },
                { status: 500 }
            );
        }

        if (!participantsData || participantsData.length === 0) {
            return NextResponse.json(
                { error: 'El curso no tiene participantes inscritos' },
                { status: 400 }
            );
        }

        const participants = participantsData
            .map((p: any) => p.employee)
            .filter((e: any) => e !== null)
            .map((e: any) => ({
                employee_number: e.employee_number,
                nombre: e.nombre,
                area: e.area,
                puesto: e.puesto,
            }));

        participants.sort((a, b) => a.nombre.localeCompare(b.nombre));

        const buffer = await renderToBuffer(
            <AttendanceListPDF
                course={courseData}
                participants={participants}
            />
        );

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Lista_Asistencia_${courseData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`,
            },
        });
    } catch (error: any) {
        console.error('Error generating attendance list PDF:', error);
        return NextResponse.json(
            {
                error: 'Error al generar la lista de asistencia',
                details: error?.message || String(error)
            },
            { status: 500 }
        );
    }
}
