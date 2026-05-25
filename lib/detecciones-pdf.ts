import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { STATUS_CONFIG } from './detecciones-utils';

export interface DeteccionesPdfDeteccion {
    nombre: string;
    color: string;
    status: string | null;
    inst_interno: boolean;
    inst_externo: boolean;
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

export interface DeteccionesPdfEmpleado {
    nombre: string;
    puesto: string;
    detecciones: DeteccionesPdfDeteccion[];
}

export interface DeteccionesPdfArea {
    area: string;
    empleados: DeteccionesPdfEmpleado[];
}

export interface DeteccionesPdfData {
    year: number;
    plant_name: string;
    areas: DeteccionesPdfArea[];
    codigo_area?: string;
}

const HDR: [number, number, number] = [25, 43, 82];
const HDR2: [number, number, number] = [55, 65, 81];
const ALT: [number, number, number] = [248, 250, 252];

function d(v: string | number | null | undefined): string {
    if (v == null || v === '') return '—';
    return String(v).trim() || '—';
}

function fmtDate(v: string | null | undefined): string {
    if (!v) return '—';
    try { const [y, m, dd] = v.split('-'); return `${dd}/${m}/${y}`; }
    catch { return v; }
}

function fmtCost(v: number | null | undefined): string {
    if (v == null) return '—';
    return `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
}

function check(v: boolean): string { return v ? '✓' : '—'; }

function statusLabel(s: string | null): string {
    if (!s) return '—';
    return STATUS_CONFIG[s]?.label ?? s;
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

export async function generateDeteccionesPdf(data: DeteccionesPdfData): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 12;

    const logoB64 = await loadB64('/safe-demo_logo-blc-Photoroom.png');
    if (logoB64) doc.addImage(logoB64, 'PNG', M, 6, 30, 12);

    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(25, 43, 82);
    doc.text('DETECCIÓN DE NECESIDADES DE CAPACITACIÓN', W / 2, 11, { align: 'center' });
    doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(80, 80, 80);
    doc.text(`Año ${data.year}  —  ${data.plant_name}`, W / 2, 17, { align: 'center' });
    doc.setDrawColor(25, 43, 82).setLineWidth(0.4).line(M, 21, W - M, 21);

    let Y = 25;

    const addFooters = () => {
        const total = (doc.internal as any).getNumberOfPages();
        for (let i = 1; i <= total; i++) {
            doc.setPage(i);
            doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(130, 130, 130);
            doc.text('DNC — Detección de Necesidades de Capacitación', M, H - 5);
            doc.text('04 S10 F 23 2', W / 2, H - 5, { align: 'center' });
            doc.text(`Página ${i} de ${total}`, W - M, H - 5, { align: 'right' });
        }
    };

    for (const dept of data.areas) {
        autoTable(doc, {
            startY: Y,
            body: [[{ content: dept.area, colSpan: 11, styles: { fillColor: HDR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 } }]],
            theme: 'plain',
            margin: { left: M, right: M },
            tableWidth: W - M * 2,
        });
        Y = (doc as any).lastAutoTable.finalY;

        for (const emp of dept.empleados) {
            autoTable(doc, {
                startY: Y,
                body: [[{ content: `Empleado: ${emp.nombre}   |   Puesto: ${emp.puesto}`, colSpan: 11, styles: { fillColor: HDR2, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 } }]],
                theme: 'plain',
                margin: { left: M, right: M },
                tableWidth: W - M * 2,
            });
            Y = (doc as any).lastAutoTable.finalY;

            autoTable(doc, {
                startY: Y,
                head: [['Detección', 'Status', 'Inst.Int.', 'Inst.Ext.', 'Proveedor', 'Costo', 'Des.P', 'Hab.B', 'Prev.R', 'Hab.T', 'F.Prog', 'F.Real', 'Hrs']],
                body: emp.detecciones.map(det => [
                    det.nombre,
                    statusLabel(det.status),
                    check(det.inst_interno),
                    check(det.inst_externo),
                    d(det.proveedor_sugerido),
                    fmtCost(det.costo),
                    check(det.desarrollo_personal),
                    check(det.habilidades_blandas),
                    check(det.prevencion_riesgos),
                    check(det.habilidades_tecnicas),
                    fmtDate(det.fecha_programada),
                    fmtDate(det.fecha_real),
                    det.duration_hours != null ? `${det.duration_hours}h` : '—',
                ]),
                theme: 'grid',
                headStyles: { fillColor: HDR, textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center' },
                bodyStyles: { fontSize: 7, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 } },
                alternateRowStyles: { fillColor: ALT },
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    1: { cellWidth: 20, halign: 'center' },
                    2: { cellWidth: 20 },
                    3: { cellWidth: 20 },
                    4: { cellWidth: 20 },
                    5: { cellWidth: 16, halign: 'right' },
                    6: { cellWidth: 11, halign: 'center' },
                    7: { cellWidth: 11, halign: 'center' },
                    8: { cellWidth: 11, halign: 'center' },
                    9: { cellWidth: 11, halign: 'center' },
                    10: { cellWidth: 18, halign: 'center' },
                    11: { cellWidth: 18, halign: 'center' },
                    12: { cellWidth: 12, halign: 'center' },
                },
                margin: { left: M, right: M },
                tableWidth: W - M * 2,
            });
            Y = (doc as any).lastAutoTable.finalY + 2;
        }
        Y += 4;
    }

    addFooters();

    const fecha = new Date().toISOString().split('T')[0];
    const suffix = data.codigo_area ? `_${data.codigo_area.replace(/[^a-zA-Z0-9_\-]/g, '_')}` : '';
    doc.save(`Detecciones_${data.year}${suffix}_${fecha}.pdf`);
}
