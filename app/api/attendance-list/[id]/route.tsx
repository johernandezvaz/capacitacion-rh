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
              employee:employees(
                employee_number,
                nombre,
                area,
                puesto
              )
            `)
            .eq('course_id', courseId);

        if (participantsError || !participantsData || participantsData.length === 0) {
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

        // Load logo
        const logoPath = join(process.cwd(), 'public', 'safe-demo_logo-blc-Photoroom.png');
        let logoBase64 = '';
        try {
            const logoBuffer = readFileSync(logoPath);
            logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        } catch (error) {
            console.error('Error loading logo:', error);
        }

        // Generate PDF using jsPDF
        const doc = new jsPDF();

        // Add logo if available
        if (logoBase64) {
            try {
                doc.addImage(logoBase64, 'PNG', 14, 10, 30, 15);
            } catch (error) {
                console.error('Error adding logo to PDF:', error);
            }
        }

        // Title
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('LISTA DE ASISTENCIA', doc.internal.pageSize.getWidth() / 2, 35, { align: 'center' });

        // Course info
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Curso: ${courseData.name}`, 14, 48);
        doc.text(`Fecha: ${courseData.date}`, 14, 55);
        doc.text(`Duración: ${courseData.duration_hours} horas`, 14, 62);

        // Participants table
        const tableData = participants.map((p, index) => [
            index + 1,
            p.employee_number,
            p.nombre,
            p.area,
            p.puesto,
            '' // Firma column
        ]);

        autoTable(doc, {
            startY: 70,
            head: [['#', 'No. Empleado', 'Nombre', 'Área', 'Puesto', 'Firma']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            styles: {
                fontSize: 9,
                cellPadding: 3
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'center', cellWidth: 25 },
                2: { cellWidth: 45 },
                3: { cellWidth: 35 },
                4: { cellWidth: 35 },
                5: { cellWidth: 35 }
            }
        });

        // Footer
        const finalY = (doc as any).lastAutoTable?.finalY || 60;
        doc.setFontSize(10);
        doc.text('Total de participantes: ' + participants.length, 14, finalY + 10);

        // Generate buffer
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

        return new NextResponse(pdfBuffer, {
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
