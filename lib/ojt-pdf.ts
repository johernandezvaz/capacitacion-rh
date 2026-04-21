import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { OjtEntry, OjtSectionWithEntries, OjtSignature } from '@/lib/supabase';

export interface OjtPdfData {
  titulo: string;
  nombre: string;
  puesto: string;
  fechaInicio: string;
  fechaTermino: string;
  pilotoProceso: string;
  periodoEntrenamiento: string;
  jefeDirectoLabel: string;
  integranteBrigadaLabel: string;
  sections: OjtSectionWithEntries[];
  sigNames: Record<string, string>;
  sigDates: Record<string, string>;
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '—';
  try {
    const [y, m, d] = val.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return val;
  }
}

function val(v: string | null | undefined): string {
  return v?.trim() || '—';
}

const HEADER_COLOR: [number, number, number] = [25, 43, 82];
const SECTION_ROW_COLOR: [number, number, number] = [55, 65, 95];
const ALT_ROW: [number, number, number] = [245, 246, 248];

export async function generateOjtPdf(data: OjtPdfData): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  try {
    const response = await fetch('/safe-demo_logo-blc-Photoroom.png');
    const blob = await response.blob();
    const reader = new FileReader();
    await new Promise<void>((resolve) => {
      reader.onloadend = () => resolve();
      reader.readAsDataURL(blob);
    });
    if (reader.result && typeof reader.result === 'string') {
      doc.addImage(reader.result, 'PNG', margin, 8, 38, 16);
    }
  } catch {
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(25, 43, 82);
  doc.text('REGISTRO DE ENTRENAMIENTO EN EL PUESTO', pageW / 2, 14, { align: 'center' });

  if (data.titulo) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(data.titulo, pageW / 2, 21, { align: 'center' });
  }

  doc.setDrawColor(25, 43, 82);
  doc.setLineWidth(0.5);
  doc.line(margin, 26, pageW - margin, 26);

  let cursorY = 31;
  const generalesHead = [
    [
      { content: 'Puesto', styles: { fontStyle: 'bold' as const } },
      { content: 'Nombre', styles: { fontStyle: 'bold' as const } },
      { content: 'Fecha de Inicio', styles: { fontStyle: 'bold' as const } },
      { content: 'Fecha de Término', styles: { fontStyle: 'bold' as const } },
    ],
  ];
  const generalesBody = [
    [val(data.puesto), val(data.nombre), fmtDate(data.fechaInicio), fmtDate(data.fechaTermino)],
    [val(data.pilotoProceso), val(data.periodoEntrenamiento), val(data.jefeDirectoLabel), val(data.integranteBrigadaLabel)],
  ];
  const generalesHead2 = [
    [
      { content: 'Piloto de Proceso', styles: { fontStyle: 'bold' as const } },
      { content: 'Periodo de Entrenamiento', styles: { fontStyle: 'bold' as const } },
      { content: 'Jefe Directo', styles: { fontStyle: 'bold' as const } },
      { content: 'Integrante de Brigada', styles: { fontStyle: 'bold' as const } },
    ],
  ];

  autoTable(doc, {
    startY: cursorY,
    head: generalesHead,
    body: [generalesBody[0]],
    theme: 'grid',
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 40 },
      3: { cellWidth: 40 },
    },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 1;

  autoTable(doc, {
    startY: cursorY,
    head: generalesHead2,
    body: [generalesBody[1]],
    theme: 'grid',
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 'auto' },
    },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 4;

  const colHeaders = [
    'Conocimiento\nRequerido',
    'Habilidades',
    'Fuentes de\nInformación',
    'Procedimientos\nInternos',
    'Método de\nEntrenamiento',
    'Duración',
    'F. Planeada\nTerminación',
    'F. Real\nInicio',
    'F. Real\nTérmino',
    'Responsable\nEntrenamiento',
    'Firma\nEmpleado',
    'Comentarios',
  ];

  type BodyRow = (string | { content: string; colSpan: number; styles: object })[];
  const tableBody: BodyRow[] = [];

  for (const section of data.sections) {
    tableBody.push([
      {
        content: section.nombre.toUpperCase(),
        colSpan: 12,
        styles: {
          fillColor: SECTION_ROW_COLOR,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
          fontSize: 8,
        },
      },
    ]);

    for (const entry of section.entries) {
      tableBody.push([
        val(entry.conocimiento_requerido),
        val(entry.habilidades),
        val(entry.fuentes_informacion),
        val(entry.procedimientos_internos),
        val(entry.metodo_entrenamiento),
        val(entry.duracion),
        fmtDate(entry.fecha_planeada_terminacion),
        fmtDate(entry.fecha_real_inicio),
        fmtDate(entry.fecha_real_termino),
        val(entry.responsable_entrenamiento),
        val(entry.firma_empleado),
        val(entry.comentarios),
      ]);
    }
  }

  if (tableBody.length === 0) {
    tableBody.push([{ content: 'Sin entradas registradas', colSpan: 12, styles: { halign: 'center', textColor: [150, 150, 150] } }]);
  }

  autoTable(doc, {
    startY: cursorY,
    head: [colHeaders],
    body: tableBody as any,
    theme: 'grid',
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
      minCellHeight: 10,
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 2,
      valign: 'top',
    },
    alternateRowStyles: { fillColor: ALT_ROW },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 22 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 16 },
      6: { cellWidth: 18 },
      7: { cellWidth: 18 },
      8: { cellWidth: 18 },
      9: { cellWidth: 26 },
      10: { cellWidth: 22 },
      11: { cellWidth: 'auto' },
    },
    didParseCell(hookData) {
      if (hookData.row.raw && Array.isArray(hookData.row.raw) && (hookData.row.raw[0] as any)?.colSpan === 12) {
        hookData.cell.styles.fillColor = SECTION_ROW_COLOR;
      }
    },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 6;

  const sigTypes: Array<{ key: string; label: string }> = [
    { key: 'empleado', label: 'EMPLEADO' },
    { key: 'jefe_directo', label: 'JEFE DIRECTO' },
    { key: 'recursos_humanos', label: 'RECURSOS HUMANOS' },
  ];

  const sigBlockH = 28;
  if (cursorY + sigBlockH > pageH - 15) {
    doc.addPage();
    cursorY = 15;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(25, 43, 82);
  doc.text('FIRMAS DE LIBERACIÓN', margin, cursorY);
  cursorY += 4;

  const sigData = sigTypes.map(({ key, label }) => ({
    label,
    name: data.sigNames[key] || '',
    date: data.sigDates[key] ? fmtDate(data.sigDates[key]) : '',
  }));

  autoTable(doc, {
    startY: cursorY,
    head: [[
      { content: sigData[0].label, styles: { halign: 'center' } },
      { content: sigData[1].label, styles: { halign: 'center' } },
      { content: sigData[2].label, styles: { halign: 'center' } },
    ]],
    body: [
      [
        `Nombre: ${sigData[0].name || '______________________________'}\nFecha:    ${sigData[0].date || '____________________'}`,
        `Nombre: ${sigData[1].name || '______________________________'}\nFecha:    ${sigData[1].date || '____________________'}`,
        `Nombre: ${sigData[2].name || '______________________________'}\nFecha:    ${sigData[2].date || '____________________'}`,
      ],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 5,
      minCellHeight: 18,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
  });

  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
  }

  const safeTitle = (data.titulo || 'OJT').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
  const today = new Date().toISOString().split('T')[0];
  doc.save(`OJT_${safeTitle}_${today}.pdf`);
}
