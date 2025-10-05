import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { updateInvoiceRounding } from '@/lib/invoicing/invoiceLines';
import { InvoiceConflictError, InvoiceNotFoundError } from '@/lib/invoicing/invoices';
import { invoiceRoundingUpdateSchema } from '@/lib/invoicing/validation';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

function wantsJson(req: Request): boolean {
  const accept = req.headers.get('accept') || '';
  const contentType = req.headers.get('content-type') || '';
  return accept.includes('application/json') || contentType.includes('application/json');
}

async function resolveParams(ctx: { params: Promise<{ id: string }> }): Promise<string> {
  const { id } = await ctx.params;
  return id;
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await req.json()) as Record<string, unknown>;
  }
  const form = await req.formData();
  return Object.fromEntries(form.entries());
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

  const invoiceId = await resolveParams(ctx);
  const raw = await parseBody(req);

  const parsed = invoiceRoundingUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  try {
    const invoice = await updateInvoiceRounding(tenant.prisma, invoiceId, parsed.data);
    return NextResponse.json({ ok: true, invoice });
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 404 });
    }
    if (error instanceof InvoiceConflictError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 409 });
    }
    console.error('Failed to update rounding', error);
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

  const invoiceId = await resolveParams(ctx);
  const raw = await parseBody(req);
  const csrf = typeof raw.csrf === 'string' ? raw.csrf : '';
  if (!(await verifyCsrfForRequest(req, csrf))) {
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=rounding-csrf`, req.url);
    return NextResponse.redirect(url, 303);
  }

  const parsed = invoiceRoundingUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=rounding-validation`, req.url);
    return NextResponse.redirect(url, 303);
  }

  try {
    const invoice = await updateInvoiceRounding(tenant.prisma, invoiceId, parsed.data);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: true, invoice });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}`, req.url);
    url.searchParams.set('flash', 'rounding-updated');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    if (error instanceof InvoiceNotFoundError || error instanceof InvoiceConflictError) {
      if (wantsJson(req)) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 409 });
      }
      const slug = error instanceof InvoiceNotFoundError ? 'invoice' : 'rounding-conflict';
      const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=${slug}`, req.url);
      return NextResponse.redirect(url, 303);
    }
    console.error('Failed to update rounding', error);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=rounding-server`, req.url);
    return NextResponse.redirect(url, 303);
  }
}
