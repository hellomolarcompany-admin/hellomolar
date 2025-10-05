import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import {
  PriceListNotFoundError,
  listPriceListEntries,
  upsertPriceListEntry,
} from '@/lib/invoicing/priceLists';
import { TreatmentCodeNotFoundError } from '@/lib/invoicing/treatments';
import { priceListEntryUpsertSchema } from '@/lib/invoicing/validation';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

async function resolveId(ctx: { params: Promise<{ id: string }> }): Promise<string> {
  const { id } = await ctx.params;
  return id;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const priceListId = await resolveId(ctx);
  try {
    const items = await listPriceListEntries(tenant.prisma, priceListId);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    if (error instanceof PriceListNotFoundError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 404 });
    }
    console.error('Failed to list price list entries', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const priceListId = await resolveId(ctx);
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
  const parsed = priceListEntryUpsertSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { ok: false, message: 'Validation failed', errors: fieldErrors },
      { status: 422 },
    );
  }

  try {
    const entry = await upsertPriceListEntry(tenant.prisma, priceListId, parsed.data);
    return NextResponse.json({ ok: true, item: entry }, { status: 201 });
  } catch (error) {
    if (error instanceof PriceListNotFoundError || error instanceof TreatmentCodeNotFoundError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 404 });
    }
    console.error('Failed to upsert price list entry', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
