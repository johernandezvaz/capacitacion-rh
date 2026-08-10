import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({
      user: null,
      plant: null,
      role: null,
    });
  }

  try {
    const result = await query(
      `
      SELECT
        up.plant_id,
        up.role,
        p.name AS plant_name
      FROM user_plants up
      INNER JOIN plants p ON p.id = up.plant_id
      WHERE up.user_id = $1
      ORDER BY up.created_at ASC
      LIMIT 1
      `,
      [session.user.id]
    );

    const plant = result.rows[0]
      ? {
        id: result.rows[0].plant_id,
        name: result.rows[0].plant_name,
      }
      : null;

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        force_password_change: session.user.forcePasswordChange,
      },
      plant,
      role: result.rows[0]?.role ?? null,
    });
  } catch (error) {
    console.error('[auth/session] Error loading plant:', error);

    return NextResponse.json(
      {
        user: {
          id: session.user.id,
          email: session.user.email,
          force_password_change: session.user.forcePasswordChange,
        },
        plant: null,
        role: null,
      },
      { status: 500 }
    );
  }
}   