import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { controlPrisma } from '@/lib/controlPlane';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const diagnostics: {
    now: string;
    env: string;
    controlDbUrlPresent: boolean;
    steps: {
      prismaConnect: { ok: boolean; error?: string };
      pingSelect1: { ok: boolean; error?: string };
      countTenants: { ok: boolean; error?: string; count?: number };
    };
  } = {
    now: new Date().toISOString(),
    env: process.env.NODE_ENV || 'unknown',
    controlDbUrlPresent: !!process.env.CONTROL_DATABASE_URL,
    steps: {
      prismaConnect: { ok: false },
      pingSelect1: { ok: false },
      countTenants: { ok: false },
    },
  };
  try {
    await controlPrisma.$connect();
    diagnostics.steps.prismaConnect.ok = true;
  } catch (e: unknown) {
    diagnostics.steps.prismaConnect.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, diagnostics }, { status: 500 });
  }
  try {
    await controlPrisma.$queryRaw`SELECT 1`;
    diagnostics.steps.pingSelect1.ok = true;
  } catch (e: unknown) {
    diagnostics.steps.pingSelect1.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, diagnostics }, { status: 500 });
  }
  try {
    const count = await controlPrisma.tenant.count();
    diagnostics.steps.countTenants.ok = true;
    diagnostics.steps.countTenants.count = count;
  } catch (e: unknown) {
    diagnostics.steps.countTenants.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, diagnostics }, { status: 500 });
  }
  return NextResponse.json({ ok: true, diagnostics });
}
