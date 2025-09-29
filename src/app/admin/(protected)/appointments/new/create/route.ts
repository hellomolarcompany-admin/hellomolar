import { AppointmentReason } from '@prisma/client';
import { NextResponse } from 'next/server';

import { createAppointmentRequest } from '@/lib/appointments/service';
import { appointmentRequestCreateSchema } from '@/lib/appointments/validation';
import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

function castReasons(values: string[]): AppointmentReason[] {
  const valid = new Set(Object.values(AppointmentReason));
  return values.filter((value): value is AppointmentReason =>
    valid.has(value as AppointmentReason),
  );
}

export async function POST(req: Request) {
  if (!modules.apprequest) {
    return NextResponse.redirect(new URL('/admin/appointments?err=module', req.url));
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL('/admin/login?err=auth', req.url));
  }

  const form = await req.formData();
  const csrf = String(form.get('csrf') || '');
  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.redirect(new URL('/admin/appointments/new?err=csrf', req.url));
  }

  const tenant = await getTenantClient();
  if (!tenant) {
    return NextResponse.redirect(new URL('/admin/appointments?err=tenant', req.url));
  }
  const prisma = tenant.prisma;

  const mode = (String(form.get('patient_mode') || 'new') === 'existing' ? 'existing' : 'new') as
    | 'existing'
    | 'new';

  const patient =
    mode === 'existing'
      ? {
          mode: 'existing' as const,
          patientId: String(form.get('patient_id') || ''),
          preferredLocale: String(form.get('preferred_locale') || 'en'),
        }
      : {
          mode: 'new' as const,
          firstName: String(form.get('first_name') || '').trim(),
          lastName: String(form.get('last_name') || '').trim(),
          email: String(form.get('email') || '').trim() || undefined,
          phone: String(form.get('phone') || '').trim() || undefined,
          dob: String(form.get('dob') || '').trim() || undefined,
          preferredLocale: String(form.get('preferred_locale') || 'en'),
        };

  const reasons = castReasons(form.getAll('reasons').map((value) => String(value)));
  const plannedDurationMinutes = Number(form.get('planned_duration') || '0');
  const preferredProviderIds = form.getAll('preferred_provider_ids').map((value) => String(value));

  const availabilityEntries = ['mon', 'tue', 'wed', 'thu', 'fri'].map((day) => {
    const slots = form.getAll(`availability_${day}`).map((value) => String(value));
    return [day, slots] as const;
  });
  const availability = Object.fromEntries(
    availabilityEntries.filter(([, slots]) => slots.length > 0),
  ) as Record<string, string[]>;

  const notes = String(form.get('notes') || '').trim() || undefined;

  const isEmergency = reasons.includes(AppointmentReason.EMERGENCY);
  const triage = isEmergency
    ? {
        painLevel: Number(form.get('triage_pain_level') || '0'),
        swelling: String(form.get('triage_swelling') || 'none'),
        fever: form.get('triage_fever') != null,
        bleeding: String(form.get('triage_bleeding') || 'none'),
        toothInjury: String(form.get('triage_tooth_injury') || 'none'),
        redFlags: {
          troubleSwallowingOrBreathing: form.get('triage_redflag_swallow') != null,
          severeFacialTrauma: form.get('triage_redflag_trauma') != null,
        },
      }
    : undefined;

  const parsed = appointmentRequestCreateSchema.safeParse({
    patient,
    reasons,
    plannedDurationMinutes: Number.isFinite(plannedDurationMinutes)
      ? plannedDurationMinutes
      : undefined,
    preferredProviderIds,
    availability,
    notes,
    triage,
    createdByStaffId: undefined,
    preferredLocale: String(form.get('preferred_locale') || 'en'),
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL('/admin/appointments/new?err=validation', req.url));
  }

  const data = parsed.data;

  try {
    const result = await createAppointmentRequest(prisma, {
      ...data,
      tenantId: tenant.info.id,
    });
    return NextResponse.redirect(
      new URL(`/admin/appointments/${result.request.id}?ok=1`, req.url),
      303,
    );
  } catch (error) {
    console.error('Failed to create appointment request', error);
    return NextResponse.redirect(new URL('/admin/appointments/new?err=server', req.url));
  }
}
