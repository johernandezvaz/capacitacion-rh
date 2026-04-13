import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import fs from 'fs';
import path from 'path';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const questionnaireId = resolvedParams.id;

        const { data: questionnaireData, error: questionnaireError } = await supabase
            .from('questionnaires')
            .select(`
                id,
                type,
                status,
                submitted_at,
                average_score,
                additional_comments,
                course_participant:course_participants(
                    id,
                    course_id,
                    course:courses(name, start_date, duration_hours),
                    employee:employees(nombre, employee_number, puesto, area)
                )
            `)
            .eq('id', questionnaireId)
            .maybeSingle();

        if (questionnaireError) throw questionnaireError;
        if (!questionnaireData) {
            return NextResponse.json(
                { error: 'Cuestionario no encontrado' },
                { status: 404 }
            );
        }

        if (!questionnaireData.submitted_at) {
            return NextResponse.json(
                { error: 'El cuestionario no ha sido completado' },
                { status: 400 }
            );
        }

        const { data: responsesData, error: responsesError } = await supabase
            .from('questionnaire_responses')
            .select('*')
            .eq('questionnaire_id', questionnaireId)
            .order('question_key');

        if (responsesError) throw responsesError;

        const { data: signaturesData } = await supabase
            .from('questionnaire_signatures')
            .select('*')
            .eq('questionnaire_id', questionnaireId)
            .order('signed_at');

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - 2 * margin;
        let currentY = margin;

        const addLogo = () => {
            try {
                const logoPath = path.join(process.cwd(), 'public', 'safe-demo_logo-blc-Photoroom.png');
                const logoBuffer = fs.readFileSync(logoPath);
                const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

                const logoWidth = 40;
                const logoHeight = 15;
                doc.addImage(logoBase64, 'PNG', margin, currentY, logoWidth, logoHeight);
                currentY += logoHeight + 10;
            } catch (error) {
                console.error('Error loading logo:', error);
            }
        };

        const addNewPageIfNeeded = (requiredSpace: number) => {
            if (currentY + requiredSpace > pageHeight - margin) {
                doc.addPage();
                currentY = margin;
                return true;
            }
            return false;
        };

        const addWrappedText = (text: string, x: number, maxWidth: number, fontSize: number = 10) => {
            doc.setFontSize(fontSize);
            const lines = doc.splitTextToSize(text, maxWidth);
            lines.forEach((line: string) => {
                addNewPageIfNeeded(7);
                doc.text(line, x, currentY);
                currentY += 7;
            });
        };

        addLogo();

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        const questionnaireType = questionnaireData.type === 'hot' ? 'Empleado' : 'Evaluador';
        doc.text(`Cuestionario del ${questionnaireType}`, margin, currentY);
        currentY += 12;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const courseParticipant = questionnaireData.course_participant as any;
        const course = courseParticipant.course;
        const employee = courseParticipant.employee;

        doc.setFont('helvetica', 'bold');
        doc.text('Información General', margin, currentY);
        currentY += 8;
        doc.setFont('helvetica', 'normal');

        const addInfoRow = (label: string, value: string) => {
            const fullText = `${label}: ${value}`;
            addWrappedText(fullText, margin, contentWidth, 10);
            currentY += 2;
        };

        const courseDate = course.start_date
            ? new Date(course.start_date + 'T12:00:00')
            : new Date();

        addInfoRow('Curso', course.name);
        addInfoRow('Fecha del curso', courseDate.toLocaleDateString('es-MX'));
        addInfoRow('Duración', `${course.duration_hours} horas`);
        addInfoRow('Empleado', employee.nombre);
        addInfoRow('No. Empleado', employee.employee_number);
        addInfoRow('Puesto', employee.puesto);
        addInfoRow('Área', employee.area);
        currentY += 4;

        doc.setDrawColor(200, 200, 200);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 10;

        const evaluationResponses = responsesData.filter((r: any) => r.section === 'evaluation');
        if (evaluationResponses.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            addNewPageIfNeeded(10);
            doc.text('Evaluación del Curso', margin, currentY);
            currentY += 8;

            evaluationResponses.forEach((response: any, index: number) => {
                addNewPageIfNeeded(20);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                addWrappedText(`${index + 1}. ${response.question_text}`, margin, contentWidth, 10);

                doc.setFont('helvetica', 'normal');
                if (response.percentage_value !== null) {
                    const percentageLabel =
                        response.percentage_value === 40 ? 'Bajo (40%)' :
                            response.percentage_value === 60 ? 'Suficiente (60%)' :
                                response.percentage_value === 80 ? 'Bien (80%)' :
                                    'Excelente (100%)';
                    doc.text(`Respuesta: ${percentageLabel}`, margin + 5, currentY);
                    currentY += 8;
                }
            });

            if (questionnaireData.average_score !== null) {
                currentY += 2;
                doc.setFont('helvetica', 'bold');
                doc.text(`Promedio general: ${questionnaireData.average_score}%`, margin, currentY);
                currentY += 10;
            }
        }

        const feedbackResponses = responsesData.filter((r: any) => r.section === 'feedback');
        if (feedbackResponses.length > 0) {
            addNewPageIfNeeded(15);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('Retroalimentación', margin, currentY);
            currentY += 8;

            feedbackResponses.forEach((response: any, index: number) => {
                addNewPageIfNeeded(20);

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                addWrappedText(`${index + 1}. ${response.question_text}`, margin, contentWidth, 10);

                doc.setFont('helvetica', 'normal');
                if (response.response_type === 'yes_no' && response.yes_no_value !== null) {
                    doc.text(`Respuesta: ${response.yes_no_value ? 'Sí' : 'No'}`, margin + 5, currentY);
                    currentY += 8;
                } else if (response.response_type === 'text' && response.text_value) {
                    doc.text('Respuesta:', margin + 5, currentY);
                    currentY += 6;
                    addWrappedText(response.text_value, margin + 5, contentWidth - 5, 9);
                    currentY += 2;
                }
            });
        }

        if (questionnaireData.additional_comments) {
            addNewPageIfNeeded(20);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('Comentarios Adicionales', margin, currentY);
            currentY += 8;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            addWrappedText(questionnaireData.additional_comments, margin, contentWidth, 10);
            currentY += 5;
        }

        if (signaturesData && signaturesData.length > 0) {
            addNewPageIfNeeded(30);
            currentY += 10;
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, currentY, pageWidth - margin, currentY);
            currentY += 10;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('Firmas', margin, currentY);
            currentY += 8;

            signaturesData.forEach((signature: any) => {
                addNewPageIfNeeded(15);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                const signerTypeLabel = signature.signer_type === 'employee' ? 'Empleado' : 'Evaluador';
                doc.text(`${signerTypeLabel}: ${signature.signer_name}`, margin, currentY);
                currentY += 6;
            });
        }

        const pdfBuffer = new Uint8Array(doc.output('arraybuffer'));

        const fileName = `Cuestionario_${questionnaireType}_${employee.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (error: any) {
        console.error('Error generating questionnaire PDF:', error);
        return NextResponse.json(
            { error: error.message || 'Error al generar el PDF' },
            { status: 500 }
        );
    }
}
