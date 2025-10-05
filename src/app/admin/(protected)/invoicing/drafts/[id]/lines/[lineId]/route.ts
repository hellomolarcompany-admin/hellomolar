import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import {
  InvoiceLineError,
  deleteInvoiceLine,
  updateInvoiceLine,
} from '@/lib/invoicing/invoiceLines';
import { InvoiceConflictError, InvoiceNotFoundError } from '@/lib/invoicing/invoices';
import { invoiceLineUpdateSchema } from '@/lib/invoicing/validation';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

type TenantContext = NonNullable<Awaited<ReturnType<typeof getTenantClient>>>;

function wantsJson(req: Request): boolean {
  const accept = req.headers.get('accept') || '';
  const contentType = req.headers.get('content-type') || '';
  return accept.includes('application/json') || contentType.includes('application/json');
}

async function resolveParams(ctx: {
  params: Promise<{ id: string; lineId: string }>;
}): Promise<{ invoiceId: string; lineId: string }> {
  const { id, lineId } = await ctx.params;
  return { invoiceId: id, lineId };
}

async function handleUpdate(
  req: Request,
  invoiceId: string,
  lineId: string,
  raw: Record<string, unknown>,
  prisma: TenantContext['prisma'],
) {
  const parsed = invoiceLineUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    if (wantsJson(req)) {
      return NextResponse.json(
        { ok: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=line-validation`, req.url);
    return NextResponse.redirect(url, 303);
  }

  const { csrf: _csrf, ...data } = parsed.data;

  try {
    const result = await updateInvoiceLine(prisma, invoiceId, lineId, data);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: true, line: result.line, invoice: result.invoice });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}`, req.url);
    url.searchParams.set('flash', 'line-updated');
    url.searchParams.set('line', result.line.id);
    return NextResponse.redirect(url, 303);
  } catch (error) {
    if (
      error instanceof InvoiceNotFoundError ||
      error instanceof InvoiceConflictError ||
      error instanceof InvoiceLineError
    ) {
      const status = error instanceof InvoiceNotFoundError ? 404 : 409;
      if (wantsJson(req)) {
        return NextResponse.json({ ok: false, message: error.message }, { status });
      }
      const slug = error instanceof InvoiceNotFoundError ? 'invoice' : 'line-conflict';
      const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=${slug}`, req.url);
      return NextResponse.redirect(url, 303);
    }
    console.error('Failed to update invoice line', error);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=line-server`, req.url);
    return NextResponse.redirect(url, 303);
  }
}

async function handleDelete(
  req: Request,
  invoiceId: string,
  lineId: string,
  prisma: TenantContext['prisma'],
) {
  try {
    const invoice = await deleteInvoiceLine(prisma, invoiceId, lineId);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: true, invoice });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}`, req.url);
    url.searchParams.set('flash', 'line-deleted');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    if (error instanceof InvoiceNotFoundError || error instanceof InvoiceLineError) {
      const status = error instanceof InvoiceNotFoundError ? 404 : 409;
      if (wantsJson(req)) {
        return NextResponse.json({ ok: false, message: error.message }, { status });
      }
      const slug = error instanceof InvoiceNotFoundError ? 'invoice' : 'line-conflict';
      const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=${slug}`, req.url);
      return NextResponse.redirect(url, 303);
    }
    console.error('Failed to delete invoice line', error);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=line-server`, req.url);
    return NextResponse.redirect(url, 303);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; lineId: string }> },
) {
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
  const prisma = tenant.prisma;
  const { invoiceId, lineId } = await resolveParams(ctx);
  const raw = (await req.json()) as Record<string, unknown>;
  return handleUpdate(req, invoiceId, lineId, raw, prisma);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; lineId: string }> },
) {
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
  const prisma = tenant.prisma;
  const { invoiceId, lineId } = await resolveParams(ctx);
  return handleDelete(req, invoiceId, lineId, prisma);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string; lineId: string }> }) {
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
  const prisma = tenant.prisma;
  const { invoiceId, lineId } = await resolveParams(ctx);
  const form = await req.formData();
  const action = String(form.get('_action') || 'update');
  const csrf = String(form.get('csrf') || '');
  if (!(await verifyCsrfForRequest(req, csrf))) {
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=line-csrf`, req.url);
    return NextResponse.redirect(url, 303);
  }

  const raw = Object.fromEntries(form.entries());
  if (action === 'delete') {
    return handleDelete(req, invoiceId, lineId, prisma);
  }
  return handleUpdate(req, invoiceId, lineId, raw, prisma);
}
