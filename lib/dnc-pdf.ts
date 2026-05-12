import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface DncCourse {
    name: string;
    inst_interno: string | null;
    inst_externo: string | null;
    proveedor_sugerido: string | null;
    costo: number | null;
    desarrollo_personal: boolean;
    habilidades_blandas: boolean;
    prevencion_riesgos: boolean;
    habilidades_tecnicas: boolean;
    fecha_programada: string | null;
    fecha_real: string | null;
    duration_hours: number | null;
}

export interface DncPdfData {
    employee: { nombre: string; puesto: string };
    courses: DncCourse[];
}

const HDR: [number, number, number] = [25, 43, 82];    // #192b52
const ALT: [number, number, number] = [248, 250, 252];  // ~#f8fafc

function d(v: string | null | undefined): string {
    return v?.trim() || '—';
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
    return v.toLocaleString('es-MX');
}

function bool(v: boolean): string {
    return v ? '✓' : '—';
}

async function loadB64(url: string): Promise<string | null> {
    try {
        const blob = await (await fetch(url)).blob();
        return new Promise((res) => {
            const r = new FileReader();
            r.onloadend = () => res(r.result as string);
            r.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

export async function generateDncPdf(data: DncPdfData): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 14;

    const logoB64 = await loadB64('/safe-demo_logo-blc-Photoroom.png');

    // ── Encabezado ──
    if (logoB64) {
        doc.addImage(logoB64, 'PNG', M, 8, 38, 16);
    }
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(25, 43, 82);
    doc.text('DETECCIÓN DE NECESIDADES DE CAPACITACIÓN', W / 2, 14, { align: 'center' });
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(80, 80, 80);
    doc.text('DNC', W / 2, 21, { align: 'center' });
    doc.setDrawColor(25, 43, 82).setLineWidth(0.5).line(M, 26, W - M, 26);

    let Y = 31;
    const hs = { fillColor: HDR, textColor: 255 as any, fontStyle: 'bold' as const, fontSize: 8 };

    // ── Datos del empleado ──
    autoTable(doc, {
        startY: Y,
        head: [['Nombre', 'Puesto']],
        body: [[data.employee.nombre, data.employee.puesto]],
        theme: 'grid',
        headStyles: hs,
        bodyStyles: { fontSize: 9, cellPadding: 3 },
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 'auto' } },
    });
    Y = (doc as any).lastAutoTable.finalY + 6;

    // ── Tabla de cursos ──
    const head = [[
        'Curso', 'Inst. Interno', 'Inst. Externo', 'Proveedor', 'Costo',
        'Des.\nPersonal', 'Hab.\nBlandas', 'Prev.\nRiesgos', 'Hab.\nTécnicas',
        'F. Programada', 'F. Real', 'Duración\n(hrs)',
    ]];

    const body = data.courses.map((c) => [
        d(c.name),
        d(c.inst_interno),
        d(c.inst_externo),
        d(c.proveedor_sugerido),
        fmtCost(c.costo),
        bool(c.desarrollo_personal),
        bool(c.habilidades_blandas),
        bool(c.prevencion_riesgos),
        bool(c.habilidades_tecnicas),
        fmtDate(c.fecha_programada),
        fmtDate(c.fecha_real),
        c.duration_hours != null ? String(c.duration_hours) : '—',
    ]);

    autoTable(doc, {
        startY: Y,
        head,
        body,
        theme: 'grid',
        headStyles: {
            fillColor: HDR,
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'center',
            valign: 'middle',
            minCellHeight: 12,
        },
        bodyStyles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
        alternateRowStyles: { fillColor: ALT },
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 20 },
            2: { cellWidth: 20 },
            3: { cellWidth: 22 },
            4: { cellWidth: 16, halign: 'right' },
            5: { cellWidth: 13, halign: 'center' },
            6: { cellWidth: 13, halign: 'center' },
            7: { cellWidth: 13, halign: 'center' },
            8: { cellWidth: 13, halign: 'center' },
            9: { cellWidth: 18, halign: 'center' },
            10: { cellWidth: 18, halign: 'center' },
            11: { cellWidth: 16, halign: 'center' },
        },
    });

    // ── Pie de página en todas las hojas ──
    const total = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(120);
        doc.text('DNC — Detección de Necesidades de Capacitación', M, H - 6);
        doc.text(`Página ${i} de ${total}`, W - M, H - 6, { align: 'right' });
    }

    // ── Guardar ──
    const safeName = data.employee.nombre.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    doc.save(`DNC_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
}
