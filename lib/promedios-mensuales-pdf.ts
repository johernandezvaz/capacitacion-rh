import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const HDR: [number, number, number] = [25, 43, 82];
const ALT: [number, number, number] = [248, 250, 252];

const MESES_ES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function semaforo(pct: number): [number, number, number] {
    if (pct >= 90) return [34, 197, 94];
    if (pct >= 80) return [255, 180, 51];
    return [239, 68, 68];
}

function fmtPct(n: number): string {
    return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

async function loadB64(url: string): Promise<string | null> {
    try {
        const blob = await (await fetch(url)).blob();
        return new Promise(res => {
            const r = new FileReader();
            r.onloadend = () => res(r.result as string);
            r.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

export async function generatePromediosMensualesPdf(data: {
    tipo: 'hot' | 'cold';
    year: number;
    month: number;
    promedioPlanta: number | null;
    numEvaluaciones: number;
    numEmpleados: number;
    detalle: { employee_name: string; course_name: string; promedio_curso: number }[];
}): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 14;

    const logoB64 = await loadB64('/safe-demo_logo-blc-Photoroom.png');
    if (logoB64) doc.addImage(logoB64, 'PNG', M, 8, 34, 14);

    const tipoLabel = data.tipo === 'hot' ? 'Evaluacion Caliente' : 'Evaluacion Frio';
    const mesLabel = MESES_ES[data.month - 1] ?? String(data.month);

    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(25, 43, 82);
    doc.text('PROMEDIOS MENSUALES DE CAPACITACION', W / 2, 13, { align: 'center' });

    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(80, 80, 80);
    doc.text(tipoLabel, W / 2, 19, { align: 'center' });
    doc.text(`${mesLabel} ${data.year}`, W / 2, 24, { align: 'center' });

    doc.setDrawColor(25, 43, 82).setLineWidth(0.5).line(M, 28, W - M, 28);

    let Y = 34;

    if (data.promedioPlanta == null || data.numEvaluaciones === 0) {
        doc.setFont('helvetica', 'italic').setFontSize(10).setTextColor(120, 120, 120);
        doc.text('Sin datos para este periodo', M, Y);
    } else {
        const promedioColor = semaforo(data.promedioPlanta);

        doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(25, 43, 82);
        doc.text('Promedio de Planta:', M, Y);
        doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...promedioColor);
        doc.text(fmtPct(data.promedioPlanta), M + 42, Y);

        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(80, 80, 80);
        doc.text(`Evaluaciones: ${data.numEvaluaciones}`, M, Y + 6);
        doc.text(`Empleados: ${data.numEmpleados}`, M + 42, Y + 6);

        Y += 16;

        autoTable(doc, {
            startY: Y,
            head: [['Empleado', 'Curso', 'Promedio (%)']],
            body: data.detalle.map(row => [
                row.employee_name,
                row.course_name,
                fmtPct(row.promedio_curso),
            ]),
            theme: 'grid',
            headStyles: {
                fillColor: HDR,
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 8,
                halign: 'center',
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
                valign: 'middle',
            },
            alternateRowStyles: { fillColor: ALT },
            margin: { left: M, right: M },
            tableWidth: W - M * 2,
            columnStyles: {
                0: { cellWidth: 52 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 34, halign: 'center' },
            },
            didParseCell(hookData) {
                if (hookData.section === 'body' && hookData.column.index === 2) {
                    const pct = data.detalle[hookData.row.index]?.promedio_curso;
                    if (pct != null) {
                        const [r, g, b] = semaforo(pct);
                        hookData.cell.styles.textColor = [r, g, b];
                        hookData.cell.styles.fontStyle = 'bold';
                    }
                }
            },
        });
    }

    const total = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(130, 130, 130);
        doc.text(`Promedios Mensuales — ${tipoLabel}`, M, H - 6);
        doc.text(`Pagina ${i} de ${total}`, W - M, H - 6, { align: 'right' });
    }

    doc.save(`Promedios_${data.tipo === 'hot' ? 'Caliente' : 'Frio'}_${mesLabel}_${data.year}.pdf`);
}
