import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OjtRecord } from '@/lib/supabase';

export interface PdfInstanceRow {
  entry_id: string;
  conocimiento_requerido: string | null;
  habilidades: string | null;
  fuentes_informacion: string | null;
  procedimientos_internos: string | null;
  metodo_entrenamiento: string | null;
  duracion: string | null;
  puesto_responsable: string | null;
  fecha_planeada_terminacion: string | null;
  fecha_real_inicio: string;
  fecha_real_termino: string;
  efectividad: string;
  empleado_firma_url: string | null;
  responsable_nombre: string;
  responsable_firma_url: string | null;
  comentarios: string;
}

export interface PdfSectionGroup {
  section_id: string;
  section_nombre: string;
  tipo: string;
  orden: number;
  rows: PdfInstanceRow[];
}

export interface OjtInstancePdfData {
  template: OjtRecord;
  jefeNombre: string;
  nombre: string;
  fechaInicio: string;
  fechaTermino: string;
  avgEfectividad: number | null;
  groups: PdfSectionGroup[];
  sigNames: Record<string, string>;
  sigDates: Record<string, string>;
  sigUrls: Record<string, string>;
}

const HDR: [number, number, number] = [25, 43, 82];
const SEC: [number, number, number] = [55, 65, 95];
const ALT: [number, number, number] = [245, 246, 248];

const PILOTO: Record<string, string> = {
  P01: 'P01 — Define and Deploy the strategy',
  P02: 'P02 — Manage the safety and environment',
  C02: 'C02 — Fulfill Market Expectation',
  C03: 'C03 — Manage the development of product and process',
  C04: 'C04 — Manufacture ship, invoice and be paid in mass production',
  S01: 'S01 — Manage the suppliers for product and services',
  S05: 'S05 — Perform Physical test and Metrological Measurements',
  S06: 'S06 — Manage Information Technology',
  S09: "S09 — Provide the means and infrastructure and ensure it's reliability",
  S10: 'S10 — Recruit, involve, Motivate and manage the human ressources and their health',
};

function d(v?: string | null) { return v?.trim() || '—'; }
function fmtDate(v?: string | null) {
  if (!v) return '—';
  try { const [y, m, dd] = v.split('-'); return `${dd}/${m}/${y}`; } catch { return v; }
}

async function loadB64(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return new Promise(res => { const r = new FileReader(); r.onloadend = () => res(r.result as string); r.readAsDataURL(blob); });
  } catch { return null; }
}

export async function generateOjtInstancePdf(data: OjtInstancePdfData): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;

  const imgs: Record<string, string> = {};
  const jobs: Promise<void>[] = [];

  jobs.push(loadB64('/safe-demo_logo-blc-Photoroom.png').then(b => { if (b) imgs['logo'] = b; }));
  for (const g of data.groups)
    for (const r of g.rows) {
      if (r.responsable_firma_url)
        jobs.push(loadB64(r.responsable_firma_url).then(b => { if (b) imgs[r.entry_id] = b; }));
      if (r.empleado_firma_url)
        jobs.push(loadB64(r.empleado_firma_url).then(b => { if (b) imgs[`emp_${r.entry_id}`] = b; }));
    }
  for (const t of ['empleado', 'jefe_directo', 'recursos_humanos'])
    if (data.sigUrls[t])
      jobs.push(loadB64(data.sigUrls[t]).then(b => { if (b) imgs[`sig_${t}`] = b; }));
  await Promise.all(jobs);

  if (imgs['logo']) doc.addImage(imgs['logo'], 'PNG', M, 8, 38, 16);
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(25, 43, 82);
  doc.text('REGISTRO DE ENTRENAMIENTO EN EL PUESTO', W / 2, 14, { align: 'center' });
  if (data.template.titulo) {
    doc.setFontSize(10).setFont('helvetica', 'normal').setTextColor(80, 80, 80);
    doc.text(data.template.titulo, W / 2, 21, { align: 'center' });
  }
  doc.setDrawColor(25, 43, 82).setLineWidth(0.5).line(M, 26, W - M, 26);

  let Y = 31;
  const hs = { fillColor: HDR, textColor: 255 as any, fontStyle: 'bold' as const, fontSize: 8 };
  const bs = { fontSize: 9, cellPadding: 3 };

  autoTable(doc, {
    startY: Y,
    head: [[
      { content: 'Puesto', styles: { fontStyle: 'bold' as const } },
      { content: 'Nombre del Empleado', styles: { fontStyle: 'bold' as const } },
      { content: 'Fecha Inicio', styles: { fontStyle: 'bold' as const } },
      { content: 'Fecha Término', styles: { fontStyle: 'bold' as const } },
    ]],
    body: [[d(data.template.puesto), d(data.nombre), fmtDate(data.fechaInicio), fmtDate(data.fechaTermino)]],
    theme: 'grid', headStyles: hs, bodyStyles: bs, margin: { left: M, right: M }, tableWidth: W - M * 2,
  });
  Y = (doc as any).lastAutoTable.finalY + 1;

  const pilotoVal = data.template.es_piloto_proceso
    ? (data.template.piloto_proceso_codigo ? (PILOTO[data.template.piloto_proceso_codigo] ?? data.template.piloto_proceso_codigo) : 'Sí')
    : 'No';

  autoTable(doc, {
    startY: Y,
    head: [[
      { content: 'Período de Entrenamiento', styles: { fontStyle: 'bold' as const } },
      { content: 'Jefe Directo', styles: { fontStyle: 'bold' as const } },
      { content: '¿Piloto de Proceso?', styles: { fontStyle: 'bold' as const } },
      { content: '¿Integrante de Brigada?', styles: { fontStyle: 'bold' as const } },
    ]],
    body: [[d(data.template.periodo_entrenamiento), d(data.jefeNombre), pilotoVal, data.template.es_integrante_brigada ? 'Sí' : 'No']],
    theme: 'grid', headStyles: hs, bodyStyles: bs, margin: { left: M, right: M }, tableWidth: W - M * 2,
  });
  Y = (doc as any).lastAutoTable.finalY + 4;

  if (data.avgEfectividad != null) {
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(25, 43, 82);
    doc.text(`Efectividad Promedio: ${data.avgEfectividad}%`, M, Y);
    Y += 5;
  }

  type Row = (string | { content: string; colSpan?: number; styles?: object })[];
  const body: Row[] = [];
  const meta: Array<{ isHeader: boolean; entryId?: string; efectividadVal?: number | null }> = [];

  for (const g of data.groups) {
    body.push([{ content: g.section_nombre.toUpperCase(), colSpan: 14, styles: { fillColor: SEC, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left', fontSize: 8 } }]);
    meta.push({ isHeader: true });
    for (const r of g.rows) {
      const efVal = r.efectividad ? parseFloat(r.efectividad) : null;
      body.push([
        d(r.conocimiento_requerido), d(r.habilidades), d(r.fuentes_informacion),
        d(r.procedimientos_internos), d(r.metodo_entrenamiento), d(r.duracion),
        fmtDate(r.fecha_planeada_terminacion), fmtDate(r.fecha_real_inicio || null),
        fmtDate(r.fecha_real_termino || null), r.efectividad ? `${r.efectividad}%` : '—',
        '',
        d(r.puesto_responsable), d(r.responsable_nombre), d(r.comentarios),
      ]);
      meta.push({ isHeader: false, entryId: r.entry_id, efectividadVal: efVal });
    }
  }

  autoTable(doc, {
    startY: Y,
    head: [['Conocimiento\nRequerido', 'Habilidades', 'Fuentes de\nInformación', 'Procedimientos\nInternos',
      'Método de\nEntrenamiento', 'Duración', 'F. Planeada\nTerminación',
      'F. Real\nInicio', 'F. Real\nTérmino', 'Efect.\n%', 'Firma\nEmpleado', 'Puesto\nResponsable', 'Responsable', 'Comentarios']],
    body: body as any,
    theme: 'grid',
    headStyles: { fillColor: HDR, textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center', valign: 'middle', minCellHeight: 10 },
    bodyStyles: { fontSize: 7, cellPadding: 2, valign: 'top', minCellHeight: 14 },
    alternateRowStyles: { fillColor: ALT },
    margin: { left: M, right: M },
    tableWidth: W - M * 2,
    columnStyles: {
      0: { cellWidth: 22 }, 1: { cellWidth: 18 }, 2: { cellWidth: 20 }, 3: { cellWidth: 20 },
      4: { cellWidth: 20 }, 5: { cellWidth: 12 }, 6: { cellWidth: 15 },
      7: { cellWidth: 15 }, 8: { cellWidth: 15 }, 9: { cellWidth: 10 },
      10: { cellWidth: 20 }, 11: { cellWidth: 18 }, 12: { cellWidth: 24 }, 13: { cellWidth: 'auto' },
    },
    didParseCell(hook) {
      if (hook.section === 'body' && hook.column.index === 9) {
        const m = meta[hook.row.index];
        if (m && !m.isHeader && m.efectividadVal != null) {
          if (m.efectividadVal < 80) {
            hook.cell.styles.fillColor = [240, 84, 84];
            hook.cell.styles.textColor = [245, 245, 245];
          } else {
            hook.cell.styles.fillColor = [55, 151, 119];
            hook.cell.styles.textColor = [245, 247, 248];
          }
        }
      }
    },
    didDrawCell(hook) {
      if (hook.section === 'body') {
        const m = meta[hook.row.index];
        if (m && !m.isHeader && m.entryId) {
          const { x, y, width, height } = hook.cell;
          const ih = Math.min(height - 4, 10);
          // col 10 — firma empleado
          if (hook.column.index === 10 && imgs[`emp_${m.entryId}`]) {
            try { doc.addImage(imgs[`emp_${m.entryId}`], 'PNG', x + 1, y + 1, ih * 2, ih); } catch { /* ignore */ }
          }
          // col 12 — firma responsable
          if (hook.column.index === 12 && imgs[m.entryId]) {
            try { doc.addImage(imgs[m.entryId], 'PNG', x + 1, y + 1, ih * 2, ih); } catch { /* ignore */ }
          }
        }
      }
    },
  });
  Y = (doc as any).lastAutoTable.finalY + 5;


  const notaLineHeight = 4.5;
  doc.setFontSize(8).setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.text('Nota:', M, Y);
  const notaLabelWidth = doc.getTextWidth('Nota: ');
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Cualquier entrenamiento con una efectividad menor al 80% será sujeto a reentrenamiento o repetición del curso.',
    M + notaLabelWidth,
    Y,
    { maxWidth: W - M * 2 - notaLabelWidth }
  );
  Y += notaLineHeight * 2;

  if (Y + 35 > H - 15) { doc.addPage(); Y = 15; }
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(25, 43, 82);
  doc.text('FIRMAS DE LIBERACIÓN', M, Y);
  Y += 4;

  const sigTypes = ['empleado', 'jefe_directo', 'recursos_humanos'] as const;

  autoTable(doc, {
    startY: Y,
    head: [['EMPLEADO', 'JEFE DIRECTO', 'RECURSOS HUMANOS'].map(l => ({ content: l, styles: { halign: 'center' } }))],
    body: [[
      `Nombre: ${d(data.sigNames['empleado'])}\nFecha:   ${fmtDate(data.sigDates['empleado'])}`,
      `Nombre: ${d(data.sigNames['jefe_directo'])}\nFecha:   ${fmtDate(data.sigDates['jefe_directo'])}`,
      `Nombre: ${d(data.sigNames['recursos_humanos'])}\nFecha:   ${fmtDate(data.sigDates['recursos_humanos'])}`,
    ]],
    theme: 'grid',
    headStyles: { fillColor: HDR, textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 8, cellPadding: 4, minCellHeight: 24 },
    columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 'auto' } },
    margin: { left: M, right: M },
    tableWidth: W - M * 2,
    didDrawCell(hook) {
      if (hook.section === 'body' && hook.row.index === 0) {
        const t = sigTypes[hook.column.index];
        const img = imgs[`sig_${t}`];
        if (img) {
          const { x, y, width, height } = hook.cell;
          const ih = Math.min(height - 8, 12);
          const iw = ih * 2.5;
          try { doc.addImage(img, 'PNG', x + width / 2 - iw / 2, y + 2, iw, ih); } catch { /* ignore */ }
        }
      }
    },
  });

  const total = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(120);
    doc.text('04 S10 F 01 4', M, H - 6);
    doc.text(`Página ${i} de ${total}`, W - M, H - 6, { align: 'right' });
  }

  const safe = (data.template.titulo || 'OJT').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  doc.save(`OJT_${safe}_${new Date().toISOString().split('T')[0]}.pdf`);
}
