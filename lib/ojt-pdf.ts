import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OjtRecord } from '@/types/database';

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
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;

  if (typeof window === 'undefined') {
    try {
      const { loadSignatureBufferOrDataUrl } = await import('@/lib/firmas');
      return await loadSignatureBufferOrDataUrl(url);
    } catch {
      return null;
    }
  }

  try {
    const blob = await (await fetch(url, { credentials: 'include' })).blob();
    return new Promise(res => {
      const r = new FileReader();
      r.onloadend = () => res(r.result as string);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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
    margin: { left: M, right: M },
    styles: bs,
    headStyles: hs,
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42 } },
    body: [
      [{ content: 'DATOS DE LA PLANTILLA', colSpan: 6, styles: { fillColor: SEC, textColor: 255, fontStyle: 'bold' } }],
      ['Puesto', d(data.template.puesto), 'Período', d(data.template.periodo_entrenamiento), 'Piloto Proceso', data.template.es_piloto_proceso ? (data.template.piloto_proceso_codigo ? PILOTO[data.template.piloto_proceso_codigo] ?? data.template.piloto_proceso_codigo : 'Sí') : 'No'],
      ['Integrante Brigada', data.template.es_integrante_brigada ? 'Sí' : 'No', '', '', '', ''],
      [{ content: 'DATOS DEL EMPLEADO Y EVALUACIÓN', colSpan: 6, styles: { fillColor: SEC, textColor: 255, fontStyle: 'bold' } }],
      ['Empleado', d(data.nombre), 'Jefe Directo', d(data.jefeNombre), 'Efectividad Prom.', data.avgEfectividad != null ? `${data.avgEfectividad}%` : '—'],
      ['Fecha Inicio', fmtDate(data.fechaInicio), 'Fecha Término', fmtDate(data.fechaTermino), '', ''],
    ],
  });

  Y = (doc as any).lastAutoTable.finalY + 6;

  const tableHead = [[
    'Conocimiento Requerido', 'Habilidades', 'Fuentes de Info.', 'Procedimientos',
    'Método Entr.', 'Dur.', 'F. Plan. Térm.', 'F. Real Inic.', 'F. Real Térm.', 'Efect.%',
    'Firma Emp.', 'Puesto Resp.', 'Responsable', 'Comentarios',
  ]];

  const tableBody: any[] = [];
  const signatureDraws: Array<{ x: number; y: number; w: number; h: number; key: string }> = [];

  for (const g of data.groups) {
    tableBody.push([{
      content: g.section_nombre.toUpperCase(),
      colSpan: 14,
      styles: { fillColor: SEC, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    }]);

    for (const r of g.rows) {
      tableBody.push([
        d(r.conocimiento_requerido),
        d(r.habilidades),
        d(r.fuentes_informacion),
        d(r.procedimientos_internos),
        d(r.metodo_entrenamiento),
        d(r.duracion),
        fmtDate(r.fecha_planeada_terminacion),
        fmtDate(r.fecha_real_inicio),
        fmtDate(r.fecha_real_termino),
        r.efectividad ? `${r.efectividad}%` : '—',
        '', // Space for employee signature
        d(r.puesto_responsable),
        d(r.responsable_nombre),
        d(r.comentarios),
      ]);
    }
  }

  autoTable(doc, {
    startY: Y,
    margin: { left: M, right: M },
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: HDR, textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center' },
    alternateRowStyles: { fillColor: ALT },
    body: tableBody,
    didDrawCell: (dataCell: any) => {
      if (dataCell.section === 'body') {
        const rowObj = data.groups.flatMap(g => g.rows)[dataCell.row.index - 1]; // Offset section headers
        if (!rowObj) return;

        // Draw employee signature in column index 10
        if (dataCell.column.index === 10 && imgs[`emp_${rowObj.entry_id}`]) {
          signatureDraws.push({
            x: dataCell.cell.x + 1,
            y: dataCell.cell.y + 1,
            w: dataCell.cell.width - 2,
            h: dataCell.cell.height - 2,
            key: `emp_${rowObj.entry_id}`,
          });
        }
        // Draw responsable signature in column index 12
        if (dataCell.column.index === 12 && imgs[rowObj.entry_id]) {
          signatureDraws.push({
            x: dataCell.cell.x + 1,
            y: dataCell.cell.y + 1,
            w: dataCell.cell.width - 2,
            h: dataCell.cell.height - 2,
            key: rowObj.entry_id,
          });
        }
      }
    },
  });

  for (const s of signatureDraws) {
    if (imgs[s.key]) {
      try { doc.addImage(imgs[s.key], 'PNG', s.x, s.y, Math.min(s.w, 20), Math.min(s.h, 10)); } catch {}
    }
  }

  // Liberation signatures at the bottom
  Y = (doc as any).lastAutoTable.finalY + 8;
  if (Y > H - 40) {
    doc.addPage();
    Y = 20;
  }

  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(25, 43, 82);
  doc.text('FIRMAS DE LIBERACIÓN', M, Y);
  Y += 4;

  const sigTypes = [
    { key: 'empleado', label: 'EMPLEADO' },
    { key: 'jefe_directo', label: 'JEFE DIRECTO' },
    { key: 'recursos_humanos', label: 'RECURSOS HUMANOS' },
  ];

  const colW = (W - (M * 2) - 10) / 3;

  sigTypes.forEach((st, i) => {
    const x = M + i * (colW + 5);
    doc.setDrawColor(200, 200, 200).setFillColor(250, 250, 250);
    doc.rect(x, Y, colW, 30, 'FD');

    doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(100, 100, 100);
    doc.text(st.label, x + 3, Y + 5);

    if (imgs[`sig_${st.key}`]) {
      try { doc.addImage(imgs[`sig_${st.key}`], 'PNG', x + (colW / 2) - 15, Y + 7, 30, 12); } catch {}
    }

    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(40, 40, 40);
    doc.text(`Nombre: ${data.sigNames[st.key] || '—'}`, x + 3, Y + 23);
    doc.text(`Fecha: ${fmtDate(data.sigDates[st.key])}`, x + 3, Y + 27);
  });

  doc.save(`OJT_${data.template.titulo || 'Registro'}_${new Date().toISOString().split('T')[0]}.pdf`);
}