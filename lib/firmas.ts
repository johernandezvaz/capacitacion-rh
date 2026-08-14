import path from 'node:path';
import fs from 'node:fs/promises';
import { query } from '@/lib/db';
import { AuthenticatedSession } from '@/lib/auth';

export const FIRMAS_DIR = path.resolve(process.cwd(), '..', 'firmas');

export function sanitizeSegment(str: string): string {
  return str.replace(/[^a-zA-Z0-9_\-]/g, '');
}

export function getSafeFirmasPath(...segments: string[]): string {
  const sanitized = segments.map(s => {
    return s.split(/[/\\]/).map(part => sanitizeSegment(part)).filter(Boolean).join(path.sep);
  });

  const resolved = path.resolve(FIRMAS_DIR, ...sanitized);
  const normalizedBase = path.normalize(FIRMAS_DIR);

  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    throw new Error('Acceso denegado: Intento de Path Traversal detectado.');
  }

  return resolved;
}

export async function authorizeInstanceAccess(
  session: AuthenticatedSession,
  instanceId: string
): Promise<boolean> {
  if (!session || !session.user || !session.user.id) return false;

  const res = await query(
    `SELECT i.id
     FROM ojt_instances i
     JOIN ojt_records r ON r.id = i.template_id
     LEFT JOIN user_plants up ON up.user_id = $2
     WHERE i.id = $1
       AND (
         (up.role = 'admin')
         OR (up.plant_id = r.plant_id)
       )`,
    [instanceId, session.user.id]
  );

  return res.rowCount !== null && res.rowCount > 0;
}

export function resolveSignaturePathInfo(
  fieldKey: string,
  categoryInput?: string,
  filenameInput?: string
): { category: 'entries' | 'signatures'; filename: string } {
  if (categoryInput && filenameInput) {
    const cat = categoryInput === 'entries' ? 'entries' : 'signatures';
    let fn = filenameInput.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    if (!fn.endsWith('.png')) fn += '.png';
    return { category: cat, filename: fn };
  }

  if (fieldKey.startsWith('empleado_entry_')) {
    const entryId = fieldKey.replace('empleado_entry_', '');
    return { category: 'entries', filename: `${sanitizeSegment(entryId)}_empleado.png` };
  }

  if (fieldKey.startsWith('entry_')) {
    const entryId = fieldKey.replace('entry_', '');
    return { category: 'entries', filename: `${sanitizeSegment(entryId)}_responsable.png` };
  }

  const cleanKey = sanitizeSegment(fieldKey);
  return { category: 'signatures', filename: `${cleanKey}.png` };
}

export async function loadSignatureBufferOrDataUrl(urlOrPath: string): Promise<string | null> {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith('data:image/')) return urlOrPath;

  if (urlOrPath.startsWith('/api/firmas/')) {
    try {
      const cleanPath = urlOrPath.replace('/api/firmas/', '');
      const parts = cleanPath.split('/').filter(Boolean);
      const safePath = getSafeFirmasPath(...parts);
      const buffer = await fs.readFile(safePath);
      return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  }

  return null;
}
