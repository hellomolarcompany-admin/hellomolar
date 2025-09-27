import { AppointmentRequestStatus } from '@prisma/client';
import { NextResponse } from 'next/server';

import {
  availabilityIncludes,
  dayKeyFromDate,
  slotIdFromTime,
} from '@/lib/appointments/scheduling';
import { getSession, verifyCsrfForRequest } from '@/lib/auth';
import { modules } from '@/lib/modules';
import { getTenantClient } from '@/lib/tenant';

function parseInputDate(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const iso = `${date}T${time}`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function POST(req: Request) {
  if (!modules.apprequest) {
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

  let body: { date?: string; time?: string; csrf?: string; providers?: unknown };
  try {
    body = (await req.json()) as {
      date?: string;
      time?: string;
      csrf?: string;
      providers?: unknown;
    };
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const csrf = body.csrf || '';
  if (!(await verifyCsrfForRequest(req, csrf))) {
    return NextResponse.json({ ok: false, message: 'Invalid CSRF token' }, { status: 403 });
  }

  const date = body.date || '';
  const time = body.time || '';
  const providers = Array.isArray(body.providers)
    ? body.providers.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];
  const target = parseInputDate(date, time);
  if (!target) {
    return NextResponse.json({ ok: false, message: 'Provide a valid date/time.' }, { status: 400 });
  }

  const dayKey = dayKeyFromDate(target);
  if (!dayKey) {
    return NextResponse.json({ ok: true, matches: [] });
  }

  const slotId = slotIdFromTime(target.getHours(), target.getMinutes());

  const prisma = tenant.prisma;

  const candidates = await prisma.appointmentRequest.findMany({
    where: {
      status: AppointmentRequestStatus.UNSCHEDULED,
      OR: [
        {
          availabilityMatrix: {
            path: [dayKey],
            array_contains: [slotId],
          },
        },
        { isEmergency: true },
      ],
      ...(providers.length
        ? {
            OR: [
              { preferredProviderIds: { hasSome: providers } },
              { preferredProviderIds: { equals: [] } },
            ],
          }
        : {}),
    },
    include: {
      patient: true,
    },
    orderBy: [{ effectivePriority: 'desc' }, { isEmergency: 'desc' }, { createdAt: 'asc' }],
    take: 15,
  });

  const preferredIds = Array.from(
    new Set(candidates.flatMap((request) => request.preferredProviderIds)),
  ).filter((id): id is string => typeof id === 'string' && id.length > 0);

  const providerMap = preferredIds.length
    ? await prisma.staffMember
        .findMany({
          where: { id: { in: preferredIds } },
          select: { id: true, firstName: true, lastName: true },
        })
        .then(
          (rows) => new Map(rows.map((row) => [row.id, `${row.firstName} ${row.lastName}`.trim()])),
        )
    : new Map<string, string>();

  const matches = candidates.map((request) => ({
    id: request.id,
    patientName:
      `${request.patient?.firstName ?? ''} ${request.patient?.lastName ?? ''}`.trim() || 'Unknown',
    patientContact: request.patient?.phone || request.patient?.email || null,
    reasons: request.reasons,
    effectivePriority: request.effectivePriority,
    isEmergency: request.isEmergency,
    availabilityMatch: availabilityIncludes(request.availabilityMatrix, dayKey, slotId),
    preferredMatch:
      providers.length > 0
        ? request.preferredProviderIds.some((pid) => providers.includes(pid))
        : request.preferredProviderIds.length > 0,
    preferredProviders: request.preferredProviderIds
      .map((pid) => providerMap.get(pid))
      .filter((name): name is string => typeof name === 'string' && name.length > 0),
    preferredLocale: request.preferredLocale,
  }));

  return NextResponse.json({ ok: true, matches });
}
