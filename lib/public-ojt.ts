import { pool } from '@/lib/db';

export type PublicOjtContext = {
  instanceId: string;
  templateId: string;
  plantId: string | null;
};

export async function resolvePublicOjtToken(token: string): Promise<PublicOjtContext | null> {
  if (!token) return null;

  const res = await pool.query(
    `SELECT i.id AS instance_id, i.template_id, r.plant_id
     FROM ojt_instances i
     LEFT JOIN ojt_records r ON i.template_id = r.id
     WHERE i.public_token::text = $1::text OR i.id::text = $1::text
     ORDER BY (CASE WHEN i.public_token::text = $1::text THEN 1 ELSE 2 END)
     LIMIT 1`,
    [token]
  );


  
  if (!res.rowCount) return null;

  const row = res.rows[0];
  return {
    instanceId: row.instance_id,
    templateId: row.template_id,
    plantId: row.plant_id ?? null,
  };
}
