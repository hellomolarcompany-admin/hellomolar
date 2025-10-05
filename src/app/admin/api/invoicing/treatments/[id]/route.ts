import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import {
  TreatmentCodeConflictError,
  TreatmentCodeDependencyError,
  TreatmentCodeNotFoundError,
  deleteTreatmentCode,
  getTreatmentCode,
  updateTreatmentCode,
} from '@/lib/invoicing/treatments';
import { treatmentCodeUpdateSchema } from '@/lib/invoicing/validation';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

async function resolveContext(ctx: { params: Promise<{ id: string }> }): Promise<string> {
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

  const id = await resolveContext(ctx);
  const record = await getTreatmentCode(tenant.prisma, id);
  if (!record) {
    return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: record });
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

  const id = await resolveContext(ctx);

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
  const parsed = treatmentCodeUpdateSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      { ok: false, message: 'Validation failed', errors: fieldErrors },
      { status: 422 },
    );
  }

  try {
    const updated = await updateTreatmentCode(tenant.prisma, id, parsed.data);
    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    if (error instanceof TreatmentCodeConflictError) {
      return NextResponse.json(
        { ok: false, message: 'Treatment code already exists.' },
        { status: 409 },
      );
    }
    if (error instanceof TreatmentCodeNotFoundError) {
      return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
    }
    console.error('Failed to update treatment code', error);
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

  const id = await resolveContext(ctx);

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
    await deleteTreatmentCode(tenant.prisma, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TreatmentCodeNotFoundError) {
      return NextResponse.json({ ok: false, message: 'Not found' }, { status: 404 });
    }
    if (error instanceof TreatmentCodeDependencyError) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Treatment code is linked to other records and cannot be deleted.',
        },
        { status: 409 },
      );
    }
    console.error('Failed to delete treatment code', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
