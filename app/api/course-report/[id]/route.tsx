import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { CourseReportPDF } from '@/components/course-report-pdf';
import { supabase } from '@/lib/supabase';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const courseId = resolvedParams.id;
        const { searchParams } = new URL(request.url);
        const reportType = searchParams.get('type') || 'cold';
        const participantId = searchParams.get('participantId');

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

        let participantsQuery = supabase
            .from('course_participants')
            .select(`
                id,
                employee:employees(
                    id,
                    employee_number,
                    nombre,
                    area,
                    puesto,
                    evaluador
                ),
                hot_questionnaires(id, completed_at, average_score),
                cold_questionnaires(id, evaluator_name, signature_employee_name, signature_date)
            `)
            .eq('course_id', courseId);

        if (participantId) {
            participantsQuery = participantsQuery.eq('id', participantId);
        }

        const { data: participantsData, error: participantsError } = await participantsQuery;

        if (participantsError) {
            return NextResponse.json(
                { error: 'Error al obtener participantes', details: participantsError.message },
                { status: 500 }
            );
        }

        if (!participantsData || participantsData.length === 0) {
            return NextResponse.json(
                { error: participantId ? 'Participante no encontrado' : 'El curso no tiene participantes inscritos' },
                { status: 400 }
            );
        }

        const incompleteParticipants: string[] = [];

        for (const participant of participantsData) {
            const employee = Array.isArray(participant.employee) ? participant.employee[0] : participant.employee;

            if (!employee) continue;

            const hasHot = participant.hot_questionnaires?.length > 0 &&
                participant.hot_questionnaires[0].completed_at;
            const hasCold = participant.cold_questionnaires?.length > 0;
            const coldData = hasCold ? participant.cold_questionnaires[0] : null;
            const hasColdComplete = coldData &&
                coldData.evaluator_name &&
                coldData.signature_employee_name &&
                coldData.signature_date;

            if (reportType === 'hot' && !hasHot) {
                incompleteParticipants.push(`${employee.nombre} (cuestionario caliente pendiente)`);
            } else if (reportType === 'cold' && (!hasHot || !hasColdComplete)) {
                const missing: string[] = [];
                if (!hasHot) missing.push('cuestionario caliente');
                if (!hasColdComplete) missing.push('cuestionario frío con firmas');
                incompleteParticipants.push(`${employee.nombre} (falta: ${missing.join(', ')})`);
            }
        }

        if (incompleteParticipants.length > 0) {
            console.log(`Cannot generate ${reportType} report. Incomplete participants:`, incompleteParticipants);
            return NextResponse.json(
                {
                    error: `No se puede generar el reporte ${reportType === 'hot' ? 'caliente' : 'frío'}`,
                    reason: 'Hay participantes que no han completado todos los requisitos',
                    incompleteParticipants,
                },
                { status: 400 }
            );
        }

        const participants = participantsData.map((p: any) => {
            const employee = Array.isArray(p.employee) ? p.employee[0] : p.employee;
            return {
                employee_number: employee?.employee_number || '',
                nombre: employee?.nombre || '',
                area: employee?.area || '',
                puesto: employee?.puesto || '',
                evaluador: employee?.evaluador || '',
                hot_score: p.hot_questionnaires?.[0]?.average_score || null,
                cold_score: reportType === 'cold' ? (p.hot_questionnaires?.[0]?.average_score || null) : null,
            };
        }).filter(p => p.employee_number);

        const scores = participants
            .map(p => reportType === 'hot' ? p.hot_score : p.cold_score)
            .filter((score): score is number => score !== null);

        const averageScore = scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null;

        const logoPath = join(process.cwd(), 'public', 'safe-demo_logo-blc-photoroom.png');
        let logoBase64 = '';

        try {
            const logoBuffer = readFileSync(logoPath);
            logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        } catch (error) {
            console.error('Error loading logo:', error);
        }

        const reportData = {
            courseName: courseData.name,
            courseDate: courseData.date,
            courseDuration: courseData.duration_hours,
            totalParticipants: participants.length,
            participants,
            averageScore,
            reportType: reportType as 'hot' | 'cold',
            logoBase64,
        };

        const buffer = await renderToBuffer(<CourseReportPDF data={reportData} />);

        const reportTypeName = reportType === 'hot' ? 'Caliente' : 'Frio';
        const participantSuffix = participantId ? `_${participants[0].nombre.replace(/\s+/g, '_')}` : '';
        const fileName = `Reporte_${reportTypeName}_${courseData.name.replace(/\s+/g, '_')}${participantSuffix}_${new Date().toISOString().split('T')[0]}.pdf`;

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        return NextResponse.json(
            { error: 'Error al generar el PDF' },
            { status: 500 }
        );
    }
}
