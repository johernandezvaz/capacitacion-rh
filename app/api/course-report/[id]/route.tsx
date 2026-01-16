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

        const { data: courseData, error: courseError } = await supabase
            .from('courses')
            .select('name, date, duration_hours')
            .eq('id', courseId)
            .maybeSingle();

        if (courseError || !courseData) {
            return NextResponse.json(
                { error: 'Curso no encontrado' },
                { status: 404 }
            );
        }

        const { data: participantsData, error: participantsError } = await supabase
            .from('course_participants')
            .select(`
        id,
        employee:employees(
          id,
          employee_number,
          nombre,
          area,
          puesto
        )
      `)
            .eq('course_id', courseId);

        if (participantsError) {
            return NextResponse.json(
                { error: 'Error al obtener participantes' },
                { status: 500 }
            );
        }

        if (!participantsData || participantsData.length === 0) {
            return NextResponse.json(
                { error: 'El curso no tiene participantes inscritos' },
                { status: 400 }
            );
        }

        const participantIds = participantsData?.map((p: any) => p.id) || [];

        const { data: questionnaires } = await supabase
            .from('questionnaires')
            .select('id, course_participant_id, type, average_score, status')
            .in('course_participant_id', participantIds);

        const coldQuestionnaireIds = questionnaires
            ?.filter((q) => q.type === 'cold' && q.status === 'completed')
            .map((q) => q.id) || [];

        let signatures: any[] = [];
        if (coldQuestionnaireIds.length > 0) {
            const { data: signaturesData } = await supabase
                .from('questionnaire_signatures')
                .select('questionnaire_id, signer_type')
                .in('questionnaire_id', coldQuestionnaireIds);

            signatures = signaturesData || [];
        }

        const incompleteParticipants: string[] = [];

        for (const participant of participantsData) {
            const hotQ = questionnaires?.find(
                (q) => q.course_participant_id === participant.id && q.type === 'hot'
            );
            const coldQ = questionnaires?.find(
                (q) => q.course_participant_id === participant.id && q.type === 'cold'
            );

            const hasCompletedHot = hotQ && hotQ.status === 'completed';
            const hasCompletedCold = coldQ && coldQ.status === 'completed';

            let hasRequiredSignatures = false;
            if (coldQ && hasCompletedCold) {
                const coldSignatures = signatures.filter(
                    (s) => s.questionnaire_id === coldQ.id
                );
                const hasEmployeeSignature = coldSignatures.some(
                    (s) => s.signer_type === 'employee'
                );
                const hasEvaluatorSignature = coldSignatures.some(
                    (s) => s.signer_type === 'evaluator'
                );
                hasRequiredSignatures = hasEmployeeSignature && hasEvaluatorSignature;
            }

            if (!hasCompletedHot || !hasCompletedCold || !hasRequiredSignatures) {
                const employeeName = (participant as any).employee.nombre;
                const missing: string[] = [];
                if (!hasCompletedHot) missing.push('cuestionario caliente');
                if (!hasCompletedCold) missing.push('cuestionario frío');
                if (hasCompletedCold && !hasRequiredSignatures) missing.push('firmas completas');

                incompleteParticipants.push(`${employeeName} (falta: ${missing.join(', ')})`);
            }
        }

        if (incompleteParticipants.length > 0) {
            return NextResponse.json(
                {
                    error: 'No se puede generar el reporte',
                    reason: 'Hay participantes que no han completado todos los requisitos',
                    incompleteParticipants,
                },
                { status: 400 }
            );
        }

        const participants = participantsData?.map((p: any) => {
            const hotQ = questionnaires?.find(
                (q) => q.course_participant_id === p.id && q.type === 'hot' && q.status === 'locked'
            );
            const coldQ = questionnaires?.find(
                (q) => q.course_participant_id === p.id && q.type === 'cold' && q.status === 'locked'
            );

            return {
                employee_number: p.employee.employee_number,
                nombre: p.employee.nombre,
                area: p.employee.area,
                puesto: p.employee.puesto,
                hot_score: hotQ?.average_score || null,
                cold_score: coldQ?.average_score || null,
            };
        }) || [];

        const completedHotScores = participants
            .map(p => p.hot_score)
            .filter((score): score is number => score !== null);

        const completedColdScores = participants
            .map(p => p.cold_score)
            .filter((score): score is number => score !== null);

        const averageHotScore = completedHotScores.length > 0
            ? completedHotScores.reduce((sum, score) => sum + score, 0) / completedHotScores.length
            : null;

        const averageColdScore = completedColdScores.length > 0
            ? completedColdScores.reduce((sum, score) => sum + score, 0) / completedColdScores.length
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
            averageHotScore,
            averageColdScore,
            logoBase64,
        };

        const buffer = await renderToBuffer(<CourseReportPDF data={reportData} />);

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Reporte_${courseData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`,
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
