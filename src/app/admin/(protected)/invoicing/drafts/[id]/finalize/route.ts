import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import {
  InvoiceConflictError,
  InvoiceNotFoundError,
  finalizeInvoiceDraft,
} from '@/lib/invoicing/invoices';
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

  let payload: Record<string, unknown> = {};
  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = (await req.json()) as Record<string, unknown>;
    } else {
      const form = await req.formData();
      payload = Object.fromEntries(form.entries());
    }
  } catch {
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message: 'Invalid payload' }, { status: 400 });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=finalize-payload`, req.url);
    return NextResponse.redirect(url, 303);
  }

  const csrf = typeof payload.csrf === 'string' ? payload.csrf : '';
  if (!(await verifyCsrfForRequest(req, csrf))) {
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message: 'Invalid CSRF token' }, { status: 403 });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=finalize-csrf`, req.url);
    return NextResponse.redirect(url, 303);
  }

  try {
    const invoice = await finalizeInvoiceDraft(tenant.prisma, invoiceId);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: true, invoice }, { status: 200 });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}`, req.url);
    url.searchParams.set('flash', 'invoice-finalized');
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
      const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=finalize-conflict`, req.url);
      return NextResponse.redirect(url, 303);
    }
    console.error('Failed to finalize invoice', error);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
    const url = new URL(`/admin/invoicing/drafts/${invoiceId}?err=finalize-server`, req.url);
    return NextResponse.redirect(url, 303);
  }
}
