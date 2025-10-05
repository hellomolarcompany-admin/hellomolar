import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import {
  PatientNotFoundError,
  PriceListNotFoundError,
  assignPatientPriceList,
  getPatientPriceList,
} from '@/lib/invoicing/priceLists';
import { assignPatientPriceListSchema } from '@/lib/invoicing/validation';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

async function resolvePatientId(ctx: { params: Promise<{ patientId: string }> }): Promise<string> {
  const { patientId } = await ctx.params;
  return patientId;
}

export async function GET(ctx: { params: Promise<{ patientId: string }> }) {
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

  const patientId = await resolvePatientId(ctx);

  try {
    const assignment = await getPatientPriceList(tenant.prisma, patientId);
    return NextResponse.json({ ok: true, assignment });
  } catch (error) {
    if (error instanceof PatientNotFoundError) {
      return NextResponse.json({ ok: false, message: 'Patient not found' }, { status: 404 });
    }
    console.error('Failed to fetch patient price list', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ patientId: string }> }) {
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

  const patientId = await resolvePatientId(ctx);

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
  const parsed = assignPatientPriceListSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { ok: false, message: 'Validation failed', errors: fieldErrors },
      { status: 422 },
    );
  }

  try {
    await assignPatientPriceList(tenant.prisma, patientId, parsed.data);
    const assignment = await getPatientPriceList(tenant.prisma, patientId);
    return NextResponse.json({ ok: true, assignment });
  } catch (error) {
    if (error instanceof PatientNotFoundError || error instanceof PriceListNotFoundError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 404 });
    }
    console.error('Failed to assign price list to patient', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
