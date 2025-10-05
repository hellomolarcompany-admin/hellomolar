import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import {
  PriceListConflictError,
  PriceListDependencyError,
  PriceListNotFoundError,
  deletePriceList,
  getPriceList,
  updatePriceList,
} from '@/lib/invoicing/priceLists';
import { priceListUpdateSchema } from '@/lib/invoicing/validation';
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

  const id = await resolveId(ctx);
  const url = new URL(req.url);
  const includeEntries = url.searchParams.get('include')?.split(',').includes('entries');

  try {
    const item = await getPriceList(tenant.prisma, id, { includeEntries });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof PriceListNotFoundError) {
      return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
    }
    console.error('Failed to fetch price list', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const id = await resolveId(ctx);

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
  const parsed = priceListUpdateSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { ok: false, message: 'Validation failed', errors: fieldErrors },
      { status: 422 },
    );
  }

  try {
    const updated = await updatePriceList(tenant.prisma, id, parsed.data);
    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    if (error instanceof PriceListConflictError) {
      return NextResponse.json(
        { ok: false, message: 'Price list already exists.' },
        { status: 409 },
      );
    }
    if (error instanceof PriceListNotFoundError) {
      return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
    }
    console.error('Failed to update price list', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const id = await resolveId(ctx);

  let csrf = '';
  try {
    const payload = (await req.json()) as { csrf?: string } | undefined;
    csrf = typeof payload?.csrf === 'string' ? payload.csrf : '';
  } catch {
    csrf = '';
  }

  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.json({ ok: false, message: 'Invalid CSRF token' }, { status: 403 });
  }

  try {
    await deletePriceList(tenant.prisma, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PriceListNotFoundError) {
      return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
    }
    if (error instanceof PriceListDependencyError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 409 });
    }
    console.error('Failed to delete price list', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
