import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import {
  TreatmentCodeConflictError,
  createTreatmentCode,
  listTreatmentCodes,
} from '@/lib/invoicing/treatments';
import { treatmentCodeCreateSchema } from '@/lib/invoicing/validation';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

function parseOnlyActive(searchParams: URLSearchParams): boolean | undefined {
  const value = searchParams.get('onlyActive');
  if (value == null) return undefined;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export async function GET(req: Request) {
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

  const onlyActive = parseOnlyActive(new URL(req.url).searchParams);
  const items = await listTreatmentCodes(tenant.prisma, { onlyActive });
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
  const parsed = treatmentCodeCreateSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { ok: false, message: 'Validation failed', errors: fieldErrors },
      { status: 422 },
    );
  }

  try {
    const created = await createTreatmentCode(tenant.prisma, parsed.data);
    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (error) {
    if (error instanceof TreatmentCodeConflictError) {
      return NextResponse.json(
        { ok: false, message: 'Treatment code already exists.' },
        { status: 409 },
      );
    }
    console.error('Failed to create treatment code', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
