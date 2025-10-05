import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import {
  PriceListConflictError,
  createPriceList,
  listPriceLists,
} from '@/lib/invoicing/priceLists';
import { priceListCreateSchema } from '@/lib/invoicing/validation';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

export async function GET() {
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

  const items = await listPriceLists(tenant.prisma);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
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

  let body: Record<string, unknown> & { csrf?: string };
  try {
    body = (await req.json()) as Record<string, unknown> & { csrf?: string };
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON payload' }, { status: 400 });
  }

  const csrf = typeof body.csrf === 'string' ? body.csrf : '';
  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.json({ ok: false, message: 'Invalid CSRF token' }, { status: 403 });
  }

  const { csrf: _csrf, ...data } = body;
  const parsed = priceListCreateSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { ok: false, message: 'Validation failed', errors: fieldErrors },
      { status: 422 },
    );
  }

  try {
    const created = await createPriceList(tenant.prisma, parsed.data);
    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (error) {
    if (error instanceof PriceListConflictError) {
      return NextResponse.json(
        { ok: false, message: 'Price list already exists.' },
        { status: 409 },
      );
    }
    console.error('Failed to create price list', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
