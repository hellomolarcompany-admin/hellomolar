import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { parsePriceListEntryCsv } from '@/lib/invoicing/priceListCsv';
import { importPriceListEntries } from '@/lib/invoicing/priceLists';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

async function resolveId(ctx: { params: Promise<{ id: string }> }): Promise<string> {
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

  const priceListId = await resolveId(ctx);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, message: 'Expected form-data payload' }, { status: 400 });
  }

  const csrf = String(form.get('csrf') ?? '');
  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.json({ ok: false, message: 'Invalid CSRF token' }, { status: 403 });
  }

  const fileEntry = form.get('file');
  let csvContent = '';
  if (fileEntry instanceof File) {
    if (fileEntry.size > 1_000_000) {
      return NextResponse.json({ ok: false, message: 'CSV file is too large.' }, { status: 413 });
    }
    csvContent = await fileEntry.text();
  } else {
    const inline = form.get('csv');
    csvContent = typeof inline === 'string' ? inline : '';
  }

  if (!csvContent.trim()) {
    return NextResponse.json(
      { ok: false, message: 'Upload a CSV file with price list entries.' },
      { status: 400 },
    );
  }

  const parsed = parsePriceListEntryCsv(csvContent);
  const summary = await importPriceListEntries(tenant.prisma, priceListId, parsed.entries);
  const errors = [...parsed.errors, ...summary.errors].sort((a, b) => a.line - b.line);

  const ok = errors.length === 0;
  const responseSummary = {
    created: summary.created,
    updated: summary.updated,
    skipped: summary.skipped,
  };

  if (!ok) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Import completed with errors.',
        summary: responseSummary,
        errors,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Import successful.',
    summary: responseSummary,
    errors,
  });
}
