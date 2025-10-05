import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { InvoiceConflictError, createInvoiceDraft } from '@/lib/invoicing/invoices';
import { PatientNotFoundError } from '@/lib/invoicing/priceLists';
import { invoiceDraftCreateSchema } from '@/lib/invoicing/validation';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

function wantsJson(req: Request): boolean {
  const accept = req.headers.get('accept') || '';
  const contentType = req.headers.get('content-type') || '';
  return accept.includes('application/json') || contentType.includes('application/json');
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

  const contentType = req.headers.get('content-type') || '';
  let raw: Record<string, unknown> = {};

  try {
    if (contentType.includes('application/json')) {
      raw = (await req.json()) as Record<string, unknown>;
    } else {
      const form = await req.formData();
      raw = Object.fromEntries(form.entries());
    }
  } catch {
    const message = 'Invalid payload';
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message }, { status: 400 });
    }
    const url = new URL('/admin/invoicing?err=payload', req.url);
    return NextResponse.redirect(url, 303);
  }

  const csrf = typeof raw.csrf === 'string' ? raw.csrf : '';
  if (!(await verifyCsrfForRequest(req, csrf))) {
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message: 'Invalid CSRF token' }, { status: 403 });
    }
    const url = new URL('/admin/invoicing?err=csrf', req.url);
    return NextResponse.redirect(url, 303);
  }

  const parsed = invoiceDraftCreateSchema.safeParse(raw);
  if (!parsed.success) {
    if (wantsJson(req)) {
      return NextResponse.json(
        { ok: false, message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
        { status: 422 },
      );
    }
    const url = new URL('/admin/invoicing?err=validation', req.url);
    return NextResponse.redirect(url, 303);
  }

  const { csrf: _csrf, ...data } = parsed.data;

  try {
    const draft = await createInvoiceDraft(tenant.prisma, data);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: true, item: draft }, { status: 201 });
    }
    const url = new URL(`/admin/invoicing/drafts/${draft.id}`, req.url);
    url.searchParams.set('created', '1');
    return NextResponse.redirect(url, 303);
  } catch (error) {
    if (error instanceof PatientNotFoundError) {
      if (wantsJson(req)) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 404 });
      }
      const url = new URL('/admin/invoicing?err=patient', req.url);
      return NextResponse.redirect(url, 303);
    }
    if (error instanceof InvoiceConflictError) {
      if (wantsJson(req)) {
        return NextResponse.json({ ok: false, message: error.message }, { status: 409 });
      }
      const url = new URL('/admin/invoicing?err=conflict', req.url);
      return NextResponse.redirect(url, 303);
    }
    console.error('Failed to create invoice draft', error);
    if (wantsJson(req)) {
      return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
    }
    const url = new URL('/admin/invoicing?err=server', req.url);
    return NextResponse.redirect(url, 303);
  }
}
