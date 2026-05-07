import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface DncCoursePdfData {
    course: {
        name: string;
        inst_interno: string | null;
        proveedor_sugerido: string | null;
        costo: number | null;
        desarrollo_personal: boolean;
        habilidades_blandas: boolean;
        prevencion_riesgos: boolean;
        habilidades_tecnicas: boolean;
        fecha_programada: string | null;
        fecha_real: string | null;
        duration_hours: number | null;
        comentario_dnc: string | null;
    };
    participants: Array<{
        nombre: string;
        puesto: string;
        area: string;
        departamento: string | null;
    }>;
}

const HDR: [number, number, number] = [25, 43, 82];
const ALT: [number, number, number] = [248, 250, 252];

function d(v: string | number | null | undefined): string {
    if (v == null || v === '') return '—';
    return String(v).trim() || '—';
}

function fmtDate(v: string | null | undefined): string {
    if (!v) return '—';
    try {
        const [y, m, dd] = v.split('-');
        return `${dd}/${m}/${y}`;
    } catch {
        return v;
    }
}

function fmtCost(v: number | null | undefined): string {
    if (v == null) return '—';
    return `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function check(v: boolean): string {
    return v ? '✓' : '—';
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

export async function generateDncCoursePdf(data: DncCoursePdfData): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 14;

    const logoB64 = await loadB64('/safe-demo_logo-blc-Photoroom.png');

    if (logoB64) {
        doc.addImage(logoB64, 'PNG', M, 8, 34, 14);
    }

    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(25, 43, 82);
    doc.text('DETECCIÓN DE NECESIDADES DE CAPACITACIÓN', W / 2, 14, { align: 'center' });

    doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(80, 80, 80);
    doc.text(data.course.name, W / 2, 21, { align: 'center' });

    doc.setDrawColor(25, 43, 82).setLineWidth(0.5).line(M, 27, W - M, 27);

    let Y = 33;

    const dncRows: [string, string][] = [
        ['Inst. Interno', d(data.course.inst_interno)],
        ['Proveedor Sugerido', d(data.course.proveedor_sugerido)],
        ['Costo', fmtCost(data.course.costo)],
        ['Duración (hrs)', data.course.duration_hours != null ? `${data.course.duration_hours} hrs` : '—'],
        ['Fecha Programada', fmtDate(data.course.fecha_programada)],
        ['Fecha Real', fmtDate(data.course.fecha_real)],
        ['Des. Personal', check(data.course.desarrollo_personal)],
        ['Hab. Blandas', check(data.course.habilidades_blandas)],
        ['Prev. Riesgos', check(data.course.prevencion_riesgos)],
        ['Hab. Técnicas', check(data.course.habilidades_tecnicas)],
        ['Comentario', d(data.course.comentario_dnc)],
    ];

    autoTable(doc, {
        startY: Y,
        body: dncRows.map(([label, value]) => [
            { content: label, styles: { fillColor: HDR, textColor: 255, fontStyle: 'bold', cellWidth: 55 } },
            { content: value, styles: { fillColor: [255, 255, 255] as [number, number, number], textColor: [30, 30, 30] as [number, number, number] } },
        ]),
        theme: 'grid',
        bodyStyles: { fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } },
        columnStyles: {
            0: { cellWidth: 55 },
            1: { cellWidth: 'auto' },
        },
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
    });

    Y = (doc as any).lastAutoTable.finalY + 8;

    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(25, 43, 82);
    doc.text('PARTICIPANTES DEL CURSO', M, Y);
    Y += 4;

    if (data.participants.length === 0) {
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(120, 120, 120);
        doc.text('No hay participantes inscritos en este curso.', M, Y + 5);
    } else {
        autoTable(doc, {
            startY: Y,
            head: [['Nombre', 'Puesto', 'Área', 'Departamento']],
            body: data.participants.map(p => [p.nombre, p.puesto, p.area, p.departamento || '—']),
            theme: 'grid',
            headStyles: {
                fillColor: HDR,
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 9,
                halign: 'left',
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
            },
            alternateRowStyles: { fillColor: ALT },
            margin: { left: M, right: M },
            tableWidth: W - M * 2,
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 45 },
                2: { cellWidth: 30 },
                3: { cellWidth: 35 },
            },
        });
    }

    const total = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(130, 130, 130);
        doc.text('DNC — Detección de Necesidades de Capacitación', M, H - 6);
        doc.text(`Página ${i} de ${total}`, W - M, H - 6, { align: 'right' });
    }

    const safe = data.course.name.replace(/[^a-zA-Z0-9_\- ]/g, '_').replace(/\s+/g, '_').slice(0, 50);
    const fecha = new Date().toISOString().split('T')[0];
    doc.save(`DNC_Curso_${safe}_${fecha}.pdf`);
}
