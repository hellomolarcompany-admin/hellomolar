import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { searchPatients } from '@/lib/invoicing/invoices';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

export async function GET(req: Request) {
  if (!modules.invoicing) {
    return NextResponse.json({ ok: false, message: 'Module disabled' }, { status: 404 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getTenantClient();
  if (!tenant) {
    return NextResponse.json({ ok: false, message: 'Tenant not found' }, { status: 400 });
  }

  const url = new URL(req.url);
  const query = (url.searchParams.get('q') || '').trim();
  const limit = Number(url.searchParams.get('limit') || '20');

  try {
    const items = await searchPatients(tenant.prisma, {
      query,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error('Failed to search patients', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
