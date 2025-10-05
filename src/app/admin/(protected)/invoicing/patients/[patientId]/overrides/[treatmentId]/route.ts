import { NextResponse } from 'next/server';

import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { PatientNotFoundError, deletePatientOverride } from '@/lib/invoicing/priceLists';
import { TreatmentCodeNotFoundError } from '@/lib/invoicing/treatments';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

async function resolveParams(ctx: {
  params: Promise<{ patientId: string; treatmentId: string }>;
}): Promise<{ patientId: string; treatmentId: string }> {
  const { patientId, treatmentId } = await ctx.params;
  return { patientId, treatmentId };
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ patientId: string; treatmentId: string }> },
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

  const { patientId, treatmentId } = await resolveParams(ctx);

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
    await deletePatientOverride(tenant.prisma, patientId, treatmentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PatientNotFoundError || error instanceof TreatmentCodeNotFoundError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 404 });
    }
    console.error('Failed to delete patient override', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
