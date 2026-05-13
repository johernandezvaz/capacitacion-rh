export type DeteccionStatus = 'tomado' | 'no_tomado' | 'reprogramado' | 'actualizacion' | null;

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    tomado: { label: 'Tomado', color: '#22c55e', bg: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
    no_tomado: { label: 'No tomado', color: '#ef4444', bg: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
    reprogramado: { label: 'Reprogramado', color: '#FFB433', bg: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
    actualizacion: { label: 'Actualización', color: '#3b82f6', bg: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
};

export const COLORES_DETECCION = [
    { valor: 'azul', hex: '#2166be', label: 'Actualización cada 5 años o cambios de curso', status: 'actualizacion' },
    { valor: 'verde', hex: '#22c55e', label: 'Curso tomado', status: 'tomado' },
    { valor: 'rojo', hex: '#ef4444', label: 'No tomado', status: 'no_tomado' },
    { valor: 'amarillo', hex: '#FFB433', label: 'Reprogramado', status: 'reprogramado' },
] as const;

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function fmtDate(v: string | null | undefined): string {
    if (!v) return '—';
    try {
        const [y, m, d] = v.split('T')[0].split('-');
        return `${d}/${MESES[parseInt(m, 10) - 1]}/${y}`;
    } catch {
        return v;
    }
}

export function StatusCombo({
    id,
    value,
    onChange,
}: {
    id: string;
    value: DeteccionStatus;
    onChange: (v: DeteccionStatus) => void;
}) {
    const cfg = value ? STATUS_CONFIG[value] : null;
    return (
        <div className="relative inline-flex items-center gap-1.5">
            {cfg && <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />}
            <select
                value={value ?? ''}
                onChange={e => onChange((e.target.value || null) as DeteccionStatus)}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2166be] pr-6"
                style={{ color: cfg?.color ?? '#6b7280' }}
            >
                <option value="">Sin status</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k} style={{ color: v.color }}>{v.label}</option>
                ))}
            </select>
        </div>
    );
}
