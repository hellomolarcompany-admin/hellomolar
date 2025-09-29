import { createHmac } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be configured to generate intake prefill links.');
  }
  return secret;
}

export interface PrefillPayload {
  pid: string; // patient id
  rid: string; // appointment request id
  tid: string; // tenant id
  exp: number; // unix ms expiry
  loc: string; // locale code
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4 ? 4 - (input.length % 4) : 0;
  return Buffer.from(input + '='.repeat(pad), 'base64');
}

export function signPrefillToken(payload: PrefillPayload): string {
  const secret = getSecret();
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = createHmac('sha256', secret).update(body).digest();
  return `${base64UrlEncode(body)}.${base64UrlEncode(sig)}`;
}

export function verifyPrefillToken(token: string): PrefillPayload | null {
  try {
    const [bodyPart, sigPart] = token.split('.');
    if (!bodyPart || !sigPart) return null;
    const secret = getSecret();
    const bodyBuf = base64UrlDecode(bodyPart);
    const expectedSig = createHmac('sha256', secret).update(bodyBuf).digest();
    const providedSig = base64UrlDecode(sigPart);
    if (providedSig.length !== expectedSig.length) return null;
    let mismatch = 0;
    for (let i = 0; i < expectedSig.length; i += 1) {
      mismatch |= expectedSig[i] ^ providedSig[i];
    }
    if (mismatch !== 0) return null;
    const payload = JSON.parse(bodyBuf.toString('utf8')) as PrefillPayload;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) {
      return null;
    }
    if (!payload.loc) payload.loc = 'en';
    return payload;
  } catch {
    return null;
  }
}

export async function resolvePrefillPatient(
  prisma: Pick<PrismaClient, 'patient' | 'appointmentRequest'>,
  token: string,
) {
  const payload = verifyPrefillToken(token);
  if (!payload) return null;
  const patient = await prisma.patient.findUnique({ where: { id: payload.pid } });
  if (!patient) return null;
  const request = await prisma.appointmentRequest.findUnique({ where: { id: payload.rid } });
  if (!request || request.patientId !== payload.pid) return null;
  return { payload, patient, request } as const;
}
