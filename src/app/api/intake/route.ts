import { NextResponse } from 'next/server';

import type { Prisma } from '@prisma/client';

import { isLocale } from '@/i18n/config';
import { encryptJsonToBuffer } from '@/lib/crypto';
import { verifyHCaptcha } from '@/lib/hcaptcha';
import { rateLimit, rlKeyFromRequest } from '@/lib/rateLimit';
import { getTenantClient, resolveTenant } from '@/lib/tenant';
import { IntakeSchema } from '@/lib/validation/intake';

export const runtime = 'nodejs';

function getClientIp(req: Request): string | undefined {
  const h = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (!h) return undefined;
  return h.split(',')[0].trim();
}

function guessLocale(req: Request): string {
  try {
    const ref = req.headers.get('referer');
    if (ref) {
      const u = new URL(ref);
      const first = u.pathname.split('/').filter(Boolean)[0];
      if (isLocale(first)) return first;
    }
  } catch {}
  return 'nl';
}

/**
 * Accept an intake submission, validate it, and persist to the database.
 * Encrypts the raw JSON payload into `encBlob` using AES-256-GCM.
 */
export async function POST(req: Request) {
  try {
    const host = req.headers.get('host') || '';
    const tenant = await resolveTenant();
    const tenantId = tenant?.id || 'unknown';

    // Enforce same-origin for POST
    const origin = (req.headers.get('origin') || '').toLowerCase();
    const referer = (req.headers.get('referer') || '').toLowerCase();
    const site = (req.headers.get('sec-fetch-site') || '').toLowerCase();
    const url = new URL(req.url);
    const expectedOrigin = `${url.protocol}//${host.toLowerCase()}`;
    const sameOrigin = origin === expectedOrigin || (referer && referer.startsWith(expectedOrigin));
    if (!sameOrigin || (site && site !== 'same-origin')) {
      return NextResponse.json({ ok: false, message: 'Invalid origin' }, { status: 400 });
    }

    // Body size cap
    const lenStr = req.headers.get('content-length');
    if (lenStr && Number(lenStr) > 100_000) {
      return NextResponse.json({ ok: false, message: 'Payload too large' }, { status: 413 });
    }

    // Rate limit: 5/min/IP per tenant
    const rl = await rateLimit(rlKeyFromRequest(req, 'intake', tenantId), 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, message: 'Too many requests' }, { status: 429 });
    }
    const json = await req.json();

    if (json?.botField) {
      return NextResponse.json({ ok: false, message: 'Spam gedetecteerd' }, { status: 400 });
    }

    const captchaToken = String(json?.captchaToken || '');
    const formTs = Number(json?.formTs || 0);
    const remoteip = req.headers.get('x-forwarded-for')?.split(',')[0].trim();
    const captchaOk = await verifyHCaptcha(captchaToken, remoteip || undefined);
    const now = Date.now();
    if (formTs > 0 && now - formTs < 3000) {
      return NextResponse.json({ ok: false, message: 'Form filled too quickly' }, { status: 400 });
    }

    const parsed = IntakeSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: 'Validatie mislukt', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const data = parsed.data;

    const dob = new Date(data.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      return NextResponse.json({ ok: false, message: 'Ongeldige geboortedatum' }, { status: 400 });
    }

    const residentType = data.residentType as string;

    const medicationsJson: Prisma.InputJsonValue = {
      selected: data.medical?.medicationsSelected ?? [],
      details: data.medical?.medicationDetails ?? {},
    };
    const allergiesJson: Prisma.InputJsonValue = {
      selected: data.medical?.allergiesSelected ?? [],
      details: data.medical?.allergyDetails ?? {},
    };
    const conditionsJson: Prisma.InputJsonValue = data.medical?.conditions ?? {};

    const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
    const primaryPhone: string | null = data?.phone1?.number?.replace(/\s+/g, ' ').trim() || null;
    const email: string | null = (data?.email || '').toLowerCase().trim() || null;
    const address: string | null =
      [data?.address?.street, data?.address?.number, data?.address?.city]
        .filter((v) => !!v && String(v).trim())
        .join(', ') || null;
    const country: string | null = (data?.address?.country as string) || null;
    const userAgent = req.headers.get('user-agent') ?? null;
    const ipInet = getClientIp(req) ?? null;
    const locale = guessLocale(req);
    const marketingOptIn = !!data.marketingConsent;
    const privacyAccepted = data.privacyConsent === true;

    const hadComplications =
      (data?.medical?.complicationsBefore ?? '').toString().toLowerCase() === 'ja';
    const complicationsNote = data?.medical?.complicationsDetails?.trim()
      ? data.medical.complicationsDetails
      : null;

    // Tenant encryption key fallback to env for single-tenant dev
    const encKey = tenant?.encKey || process.env.INTAKE_ENC_KEY;
    if (!encKey) {
      return NextResponse.json(
        { ok: false, message: 'Server niet juist geconfigureerd (tenant key ontbreekt)' },
        { status: 500 },
      );
    }
    const encBlob = encryptJsonToBuffer(data, encKey);

    const { prisma } = (await getTenantClient()) || { prisma: null };
    if (!prisma) {
      return NextResponse.json({ ok: false, message: 'Tenant niet gevonden' }, { status: 400 });
    }

    // Spam scoring
    let spamScore = 0;
    if (!captchaOk) spamScore += 3;
    if (json?.botField) spamScore += 5;
    if (!userAgent) spamScore += 1;

    const isSpam = spamScore >= 3;

    const created = await prisma.intakeSubmission.create({
      data: {
        fullName,
        dob,
        phone: primaryPhone,
        email,
        residentType,
        address,
        country,
        medications: medicationsJson,
        allergies: allergiesJson,
        conditions: conditionsJson,
        locale,
        marketingOptIn,
        privacyAccepted,
        userAgent,
        ipInet,
        hadComplications,
        complicationsNote,
        encBlob,
        isSpam,
      },
      select: { id: true, createdAt: true },
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('New intake stored:', created);
    }

    return NextResponse.json({ ok: true, id: created.id, createdAt: created.createdAt });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, message: 'Interne serverfout' }, { status: 500 });
  }
}
