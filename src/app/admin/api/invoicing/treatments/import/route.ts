import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { parseTreatmentCodeCsv } from '@/lib/invoicing/csv';
import { type TreatmentImportError, importTreatmentCodes } from '@/lib/invoicing/treatments';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

const MAX_UPLOAD_BYTES = 1_000_000; // ~1MB

function isFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

function mergeErrors(
  parseErrors: TreatmentImportError[],
  importErrors: TreatmentImportError[],
): TreatmentImportError[] {
  return [...parseErrors, ...importErrors].sort((a, b) => a.line - b.line);
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

  let csvContent = '';
  const fileEntry = form.get('file') ?? form.get('csv');
  if (isFile(fileEntry)) {
    if (fileEntry.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, message: 'CSV file is too large.' }, { status: 413 });
    }
    csvContent = await fileEntry.text();
  } else {
    const inline = form.get('text') ?? form.get('csv');
    if (typeof inline === 'string') {
      csvContent = inline;
    }
  }

  if (!csvContent.trim()) {
    return NextResponse.json(
      { ok: false, message: 'Upload a CSV file with treatment codes.' },
      { status: 400 },
    );
  }

  const parsed = parseTreatmentCodeCsv(csvContent);
  const summary = await importTreatmentCodes(tenant.prisma, parsed.entries);
  const errors = mergeErrors(parsed.errors, summary.errors);
  const ok = errors.length === 0 && (summary.created > 0 || summary.updated > 0);

  if (!summary.created && !summary.updated) {
    const status = errors.length ? 422 : 400;
    return NextResponse.json(
      {
        ok: false,
        message: errors.length ? 'CSV import completed with errors.' : 'No valid rows found.',
        summary: {
          created: summary.created,
          updated: summary.updated,
          skipped: summary.skipped,
        },
        errors,
      },
      { status },
    );
  }

  return NextResponse.json({
    ok,
    message: errors.length ? 'Imported with warnings.' : 'Import successful.',
    summary: {
      created: summary.created,
      updated: summary.updated,
      skipped: summary.skipped,
    },
    errors,
  });
}
