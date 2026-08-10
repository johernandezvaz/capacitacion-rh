import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
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

        const questionnaireResult = await pool.query(
            `SELECT 
                q.id,
                q.type,
                q.status,
                q.submitted_at,
                q.average_score,
                q.additional_comments,
                q.observation_1,
                c.name AS course_name,
                c.start_date AS course_start_date,
                c.duration_hours AS course_duration_hours,
                e.nombre AS employee_nombre,
                e.employee_number AS employee_number,
                e.puesto AS employee_puesto,
                e.area AS employee_area
             FROM questionnaires q
             JOIN course_participants cp ON q.course_participant_id = cp.id
             JOIN courses c ON cp.course_id = c.id
             JOIN employees e ON cp.employee_id = e.id
             WHERE q.id = $1`,
            [questionnaireId]
        );

        if (questionnaireResult.rowCount === 0) {
            return NextResponse.json(
                { error: 'Cuestionario no encontrado' },
                { status: 404 }
            );
        }

        const qRow = questionnaireResult.rows[0];

        const questionnaireData = {
            id: qRow.id,
            type: qRow.type,
            status: qRow.status,
            submitted_at: qRow.submitted_at,
            average_score: qRow.average_score != null ? Number(qRow.average_score) : null,
            additional_comments: qRow.additional_comments,
            observation_1: qRow.observation_1,
            course_participant: {
                course: {
                    name: qRow.course_name,
                    start_date: qRow.course_start_date,
                    duration_hours: qRow.course_duration_hours,
                },
                employee: {
                    nombre: qRow.employee_nombre,
                    employee_number: qRow.employee_number,
                    puesto: qRow.employee_puesto,
                    area: qRow.employee_area,
                },
            },
        };

        if (!questionnaireData.submitted_at) {
            return NextResponse.json(
                { error: 'El cuestionario no ha sido completado' },
                { status: 400 }
            );
        }

        const responsesResult = await pool.query(
            `SELECT * FROM questionnaire_responses WHERE questionnaire_id = $1 ORDER BY question_key ASC`,
            [questionnaireId]
        );
        const responsesData = responsesResult.rows.map(r => ({
            ...r,
            percentage_value: r.percentage_value != null ? Number(r.percentage_value) : null
        }));

        const signaturesResult = await pool.query(
            `SELECT * FROM questionnaire_signatures WHERE questionnaire_id = $1 ORDER BY signed_at ASC`,
            [questionnaireId]
        );
        const signaturesData = signaturesResult.rows;

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

        const evaluationResponses = questionnaireData.type === 'cold'
            ? responsesData
            : responsesData.filter((r: any) => r.section === 'evaluation');
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
                    let percentageLabel = '';
                    if (questionnaireData.type === 'cold') {
                        percentageLabel =
                            response.percentage_value === 0 ? 'N/A' :
                                response.percentage_value === 25 ? '<25%' :
                                    response.percentage_value === 40 ? '40%' :
                                        response.percentage_value === 60 ? '60%' :
                                            response.percentage_value === 80 ? '80%' :
                                                '100%';
                    } else {
                        percentageLabel =
                            response.percentage_value === 40 ? 'Bajo (40%)' :
                                response.percentage_value === 60 ? 'Suficiente (60%)' :
                                    response.percentage_value === 80 ? 'Bien (80%)' :
                                        'Excelente (100%)';
                    }
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

        if (questionnaireData.type === 'cold' && questionnaireData.observation_1?.trim()) {
            addNewPageIfNeeded(20);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('Observaciones del Evaluador', margin, currentY);
            currentY += 8;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            addWrappedText(questionnaireData.observation_1, margin, contentWidth, 10);
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
