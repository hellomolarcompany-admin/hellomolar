import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { InvoiceConflictError, InvoiceNotFoundError } from '@/lib/invoicing/invoices';
import { addInvoicePayments } from '@/lib/invoicing/payments';
import { invoicePaymentBatchSchema } from '@/lib/invoicing/validation';
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

  let raw: Record<string, unknown> = {};
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      raw = (await req.json()) as Record<string, unknown>;
    } else {
      const form = await req.formData();
      const paymentsPayload = form.get('payments');
      raw = {
        csrf: form.get('csrf') ?? '',
        payments: typeof paymentsPayload === 'string' ? JSON.parse(paymentsPayload) : [],
      };
    }
  } catch (error) {
    console.error('Failed to parse payment payload', error);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message: 'Invalid payload' }, { status: 400 });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=payments-validation`, req.url);
    return NextResponse.redirect(url, 303);
  }

  const csrf = typeof raw.csrf === 'string' ? raw.csrf : '';
  if (!(await verifyCsrfForRequest(req, csrf))) {
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message: 'Invalid CSRF token' }, { status: 403 });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=payments-csrf`, req.url);
    return NextResponse.redirect(url, 303);
  }

  const parsed = invoicePaymentBatchSchema.safeParse(raw);
  if (!parsed.success) {
    if (wantsJson(req)) {
      return NextResponse.json(
        { ok: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=payments-validation`, req.url);
    return NextResponse.redirect(url, 303);
  }

  try {
    const result = await addInvoicePayments(tenant.prisma, invoiceId, parsed.data.payments);
    if (wantsJson(req)) {
      return NextResponse.json(
        { ok: true, invoice: result.invoice, payments: result.payments },
        { status: 200 },
      );
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}`, req.url);
    url.searchParams.set('flash', 'payments-recorded');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) {
      if (wantsJson(req)) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 404 });
      }
      const url = new URL('/admin/invoicing?err=invoice', req.url);
      return NextResponse.redirect(url, 303);
    }
    if (error instanceof InvoiceConflictError) {
      if (wantsJson(req)) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 409 });
      }
      const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=payments-conflict`, req.url);
      return NextResponse.redirect(url, 303);
    }
    console.error('Failed to record payments', error);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=payments-server`, req.url);
    return NextResponse.redirect(url, 303);
  }
}
