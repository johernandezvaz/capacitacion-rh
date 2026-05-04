import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
            .select('name, start_date, duration_hours')
            .eq('id', courseId)
            .maybeSingle();

        if (courseError || !courseData) {
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
                )
            `)
            .eq('course_id', courseId);

        if (participantId) {
            participantsQuery = participantsQuery.eq('id', participantId);
        }

        const { data: participantsData, error: participantsError } = await participantsQuery;

        if (participantsError || !participantsData || participantsData.length === 0) {
            return NextResponse.json(
                { error: participantId ? 'Participante no encontrado' : 'El curso no tiene participantes inscritos' },
                { status: 400 }
            );
        }

        const participantIds = participantsData.map((p: any) => p.id);

        const { data: questionnaires } = await supabase
            .from('questionnaires')
            .select('*')
            .in('course_participant_id', participantIds);

        const questionnaireIds = questionnaires?.map((q) => q.id) || [];

        let signatures: any[] = [];
        if (questionnaireIds.length > 0) {
            const { data: signaturesData } = await supabase
                .from('questionnaire_signatures')
                .select('*')
                .in('questionnaire_id', questionnaireIds);

            signatures = signaturesData || [];
        }

        // Reporte en caliente: bloquear si algún participante no completó su cuestionario.
        // Reporte en frío: no bloquear — solo incluir en el PDF a quienes ya completaron.
        if (reportType === 'hot') {
            const incompleteParticipants: string[] = [];

            for (const participant of participantsData) {
                const employee = Array.isArray(participant.employee) ? participant.employee[0] : participant.employee;
                if (!employee) continue;

                const hotQ = questionnaires?.find((q) => q.course_participant_id === participant.id && q.type === 'hot') || null;
                const hasHot = hotQ && hotQ.status === 'completed' && hotQ.submitted_at !== null;

                if (!hasHot) {
                    incompleteParticipants.push(`${employee.nombre} (cuestionario empleado pendiente)`);
                }
            }

            if (incompleteParticipants.length > 0) {
                return NextResponse.json(
                    {
                        error: 'No se puede generar el reporte empleado',
                        reason: 'Hay participantes que no han completado todos los requisitos',
                        incompleteParticipants,
                    },
                    { status: 400 }
                );
            }
        }

        const participants = participantsData.map((p: any) => {
            const employee = Array.isArray(p.employee) ? p.employee[0] : p.employee;
            const hotQ = questionnaires?.find((q) => q.course_participant_id === p.id && q.type === 'hot') || null;
            const coldQ = questionnaires?.find((q) => q.course_participant_id === p.id && q.type === 'cold') || null;

            const hasHot = hotQ && hotQ.status === 'completed' && hotQ.submitted_at !== null;
            const hasCold = coldQ && coldQ.status === 'completed' && coldQ.submitted_at !== null;

            // Para reporte en frío: excluir participantes sin cuestionario de evaluador completado.
            if (reportType === 'cold' && !hasCold) return null;

            return {
                employee_number: employee?.employee_number || '',
                nombre: employee?.nombre || '',
                area: employee?.area || '',
                puesto: employee?.puesto || '',
                evaluador: employee?.evaluador || '',
                hot_score: hasHot ? (hotQ?.average_score ?? null) : null,
                cold_score: hasCold ? (coldQ?.average_score ?? null) : null,
            };
        }).filter((p): p is NonNullable<typeof p> => p !== null && !!p.employee_number);

        if (participants.length === 0) {
            return NextResponse.json(
                {
                    error: reportType === 'cold'
                        ? 'Aún no hay cuestionarios de evaluador completados para este curso'
                        : 'No hay participantes con cuestionarios completados'
                },
                { status: 400 }
            );
        }

        const scores = participants
            .map(p => reportType === 'hot' ? p.hot_score : p.cold_score)
            .filter((score): score is number => score !== null);

        const averageScore = scores.length > 0
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : null;

        const logoPath = join(process.cwd(), 'public', 'safe-demo_logo-blc-Photoroom.png');
        let logoBase64 = '';
        try {
            const logoBuffer = readFileSync(logoPath);
            logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        } catch (error) {
            console.error('Error loading logo:', error);
        }

        const doc = new jsPDF();

        if (logoBase64) {
            try {
                doc.addImage(logoBase64, 'PNG', 14, 10, 30, 15);
            } catch (error) {
                console.error('Error adding logo to PDF:', error);
            }
        }

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        const title = `REPORTE DE EVALUACIÓN - ${reportType === 'hot' ? 'CALIENTE' : 'FRÍO'}`;
        doc.text(title, doc.internal.pageSize.getWidth() / 2, 35, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`Curso: ${courseData.name}`, 14, 52);
        const courseDisplayDate = courseData.start_date
            ? new Date(courseData.start_date + 'T12:00:00').toLocaleDateString('es-MX')
            : new Date().toLocaleDateString('es-MX');
        doc.text(`Fecha: ${courseDisplayDate}`, 14, 58);
        doc.text(`Duración: ${courseData.duration_hours} horas`, 14, 64);
        doc.text(`Total de participantes: ${participants.length}`, 14, 70);

        if (averageScore !== null) {
            doc.setFont('helvetica', 'bold');
            doc.text(`Calificación promedio: ${averageScore.toFixed(2)}`, 14, 76);
            doc.setFont('helvetica', 'normal');
        }

        const tableData = participants.map((p, index) => [
            index + 1,
            p.employee_number,
            p.nombre,
            p.area,
            p.puesto,
            reportType === 'hot' ? (p.hot_score?.toFixed(2) || 'N/A') : (p.cold_score?.toFixed(2) || 'N/A')
        ]);

        autoTable(doc, {
            startY: 84,
            head: [['#', 'No. Empleado', 'Nombre', 'Área', 'Puesto', 'Calificación']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [52, 152, 219],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            styles: {
                fontSize: 8,
                cellPadding: 2
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'center', cellWidth: 25 },
                2: { cellWidth: 45 },
                3: { cellWidth: 30 },
                4: { cellWidth: 35 },
                5: { halign: 'center', cellWidth: 25 }
            }
        });

        const finalY = (doc as any).lastAutoTable?.finalY || 84;
        doc.setFontSize(9);
        doc.setTextColor(128, 128, 128);
        doc.text(
            `Generado el: ${new Date().toLocaleDateString('es-MX')}`,
            14,
            finalY + 10
        );

        const pdfBuffer = new Uint8Array(doc.output('arraybuffer'));

        const reportTypeName = reportType === 'hot' ? 'Empleado' : 'Evaluador';
        const participantSuffix = participantId ? `_${participants[0].nombre.replace(/\s+/g, '_')}` : '';
        const fileName = `Reporte_${reportTypeName}_${courseData.name.replace(/\s+/g, '_')}${participantSuffix}_${new Date().toISOString().split('T')[0]}.pdf`;

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (error: any) {
        console.error('Error generating PDF:', error);
        return NextResponse.json(
            {
                error: 'Error al generar el PDF',
                details: error?.message || String(error)
            },
            { status: 500 }
        );
    }
}