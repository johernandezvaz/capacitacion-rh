import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export interface CalendarioPdfFila {
    tipo: 'curso' | 'deteccion';
    nombre: string;
    dirigido_a: string | null;
    color: string;
    comentario: string | null;
    meses: Array<{
        mes: number;           // 1-12
        tiene_programado: boolean;
        tiene_real: boolean;
    }>;
}

export interface CalendarioPdfData {
    year: number;
    plant_name: string;
    filas: CalendarioPdfFila[];
}

function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ];
}

function withAlpha(rgb: [number, number, number], alpha: number): [number, number, number] {
    // Blend with white background
    return [
        Math.round(rgb[0] * alpha + 255 * (1 - alpha)),
        Math.round(rgb[1] * alpha + 255 * (1 - alpha)),
        Math.round(rgb[2] * alpha + 255 * (1 - alpha)),
    ];
}

async function loadB64(url: string): Promise<string | null> {
    try {
        const blob = await (await fetch(url)).blob();
        return new Promise(res => {
            const r = new FileReader();
            r.onloadend = () => res(r.result as string);
            r.readAsDataURL(blob);
        });
    } catch { return null; }
}

export async function generateCalendarioPdf(data: CalendarioPdfData): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 12;

    // ── Header ────────────────────────────────────────────────────────────────
    const logoB64 = await loadB64('/safe-demo_logo-blc-Photoroom.png');
    if (logoB64) doc.addImage(logoB64, 'PNG', M, 5, 32, 13);

    doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(25, 43, 82);
    doc.text(`CALENDARIO DE CAPACITACIÓN ${data.year}`, W / 2, 10, { align: 'center' });
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(80, 80, 80);
    doc.text(data.plant_name, W / 2, 16, { align: 'center' });
    doc.setDrawColor(25, 43, 82).setLineWidth(0.4).line(M, 21, W - M, 21);

    let Y = 24;

    // ── Leyenda ───────────────────────────────────────────────────────────────
    const LEGEND = [
        { color: '#4A249D', label: 'Curso realizado' },
        { color: '#2166be', label: 'Actualización cada 5 años' },
        { color: '#22c55e', label: 'Curso tomado' },
        { color: '#ef4444', label: 'No tomado' },
        { color: '#FFB433', label: 'Reprogramado' },
    ];

    doc.setFontSize(7);
    let lx = M;
    for (const leg of LEGEND) {
        const [r, g, b] = hexToRgb(leg.color);
        doc.setFillColor(r, g, b);
        doc.rect(lx, Y, 5, 4, 'F');
        doc.setTextColor(60, 60, 60);
        doc.text(leg.label, lx + 6.5, Y + 3.2);
        lx += 6 + doc.getTextWidth(leg.label) + 8;
    }
    Y += 8;

    // ── Table ─────────────────────────────────────────────────────────────────
    const HDR: [number, number, number] = [25, 43, 82];
    const ALT: [number, number, number] = [248, 250, 252];

    // Build head row
    const head = [['TEMA', 'DIRIGIDO A', ...MONTHS_SHORT, 'COMENTARIO']];

    // Build body rows (text content — colours applied via willDrawCell)
    const body = data.filas.map(fila => [
        fila.nombre,
        fila.dirigido_a || '',
        ...fila.meses.map(m => ''),   // placeholder — cells coloured below
        fila.comentario || '',
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
            cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
        },
        bodyStyles: {
            fontSize: 7,
            cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
        },
        alternateRowStyles: { fillColor: ALT },
        columnStyles: {
            0: { cellWidth: 55 },
            1: { cellWidth: 30 },
            // cols 2-13: each month (12 cols)
            2: { cellWidth: 12, halign: 'center' },
            3: { cellWidth: 12, halign: 'center' },
            4: { cellWidth: 12, halign: 'center' },
            5: { cellWidth: 12, halign: 'center' },
            6: { cellWidth: 12, halign: 'center' },
            7: { cellWidth: 12, halign: 'center' },
            8: { cellWidth: 12, halign: 'center' },
            9: { cellWidth: 12, halign: 'center' },
            10: { cellWidth: 12, halign: 'center' },
            11: { cellWidth: 12, halign: 'center' },
            12: { cellWidth: 12, halign: 'center' },
            13: { cellWidth: 12, halign: 'center' },
            14: { cellWidth: 'auto' },
        },
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
        willDrawCell: (hookData) => {
            if (hookData.section !== 'body') return;
            const colIdx = hookData.column.index;
            // Month columns are 2-13
            if (colIdx < 2 || colIdx > 13) return;

            const rowIdx = hookData.row.index;
            const fila = data.filas[rowIdx];
            if (!fila) return;

            const mesIdx = colIdx - 2; // 0-based
            const mesInfo = fila.meses[mesIdx];
            if (!mesInfo) return;

            const baseColor = hexToRgb(fila.color);

            if (mesInfo.tiene_real) {
                const [r, g, b] = baseColor;
                hookData.cell.styles.fillColor = [r, g, b];
                hookData.cell.styles.textColor = [255, 255, 255];
            } else if (mesInfo.tiene_programado) {
                const [r, g, b] = withAlpha(baseColor, 0.40);
                hookData.cell.styles.fillColor = [r, g, b];
                hookData.cell.styles.textColor = [60, 60, 60];
            }
        },
    });

    // ── Footers ───────────────────────────────────────────────────────────────
    const total = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(130, 130, 130);
        doc.text(`Calendario de Capacitación ${data.year}`, M, H - 5);
        doc.text(`Página ${i} de ${total}`, W - M, H - 5, { align: 'right' });
    }

    const fecha = new Date().toISOString().split('T')[0];
    doc.save(`Calendario_${data.year}_${fecha}.pdf`);
}
