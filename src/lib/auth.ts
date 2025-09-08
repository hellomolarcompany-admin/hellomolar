import { cookies } from 'next/headers';

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

// Password hashing using scrypt. Stored format: scrypt$N$r$p$saltB64$hashB64
const SCRYPT_N = 1 << 14; // 16384
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // Fail fast to prevent issuing or accepting unsigned/weak sessions
    throw new Error(
      'SESSION_SECRET is missing or too short; set a strong secret (32+ chars) in the environment.',
    );
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${Buffer.from(derived).toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, nStr, rStr, pStr, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt') return false;
    const N = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = scryptSync(password, salt, expected.length, { N, r, p });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// Session tokens: base64url(JSON).base64url(HMAC)
type SessionPayload = {
  uid: string;
  iat: number; // seconds
  exp: number; // seconds
  fp: string; // fingerprint (placeholder)
  ver: 1;
  tid?: string; // tenant id (for tenant sessions)
  role: 'tenant_admin' | 'tenant_user' | 'superadmin';
};

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromB64url(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s + '='.repeat(pad), 'base64');
}

export function fingerprintPlaceholder(): string {
  const digest = createHmac('sha256', getSessionSecret()).update('fp').digest();
  return b64url(digest);
}

export function signSession(payload: SessionPayload): string {
  const secret = getSessionSecret();
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = createHmac('sha256', secret).update(body).digest();
  return `${b64url(body)}.${b64url(sig)}`;
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const secret = getSessionSecret();
    const [b, s] = token.split('.');
    if (!b || !s) return null;
    const body = fromB64url(b);
    const sig = fromB64url(s);
    const expected = createHmac('sha256', secret).update(body).digest();
    if (expected.length !== sig.length || !timingSafeEqual(expected, sig)) return null;
    const parsed = JSON.parse(body.toString('utf8')) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp <= now) return null;
    // Fingerprint verification disabled to avoid async header access
    return parsed;
  } catch {
    return null;
  }
}

function secureFromRequest(req?: Request): boolean {
  try {
    if (req) {
      const proto =
        req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '');
      return proto === 'https';
    }
  } catch {}
  return process.env.NODE_ENV === 'production';
}

export async function setSessionCookie(
  payload: Omit<SessionPayload, 'iat' | 'exp' | 'fp' | 'ver'>,
  options?: { req?: Request; maxAgeHours?: number },
) {
  const maxAgeHours = options?.maxAgeHours ?? 8;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + maxAgeHours * 60 * 60;
  const session: SessionPayload = {
    uid: payload.uid,
    tid: payload.tid,
    role: payload.role,
    iat: now,
    exp,
    fp: fingerprintPlaceholder(),
    ver: 1,
  };
  const token = signSession(session);
  const cookie = await cookies();
  const secure = secureFromRequest(options?.req);
  cookie.set('ADMIN_SESSION', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: maxAgeHours * 60 * 60,
  });
}

export async function clearSessionCookie(options?: { req?: Request }) {
  const cookie = await cookies();
  const secure = secureFromRequest(options?.req);
  cookie.set('ADMIN_SESSION', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 0,
  });
}

export async function getSession() {
  const store = await cookies();
  const token = store.get('ADMIN_SESSION')?.value || '';
  if (!token) return null;
  return verifySession(token);
}

// CSRF double-submit token for the login form
export async function setCsrfToken() {
  const val = b64url(randomBytes(16));
  const secure = process.env.NODE_ENV === 'production';
  const store = await cookies();
  store.set('ADMIN_CSRF', val, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    path: '/',
  });
  return val;
}

export async function verifyCsrfToken(value: string | null | undefined): Promise<boolean> {
  const store = await cookies();
  const stored = store.get('ADMIN_CSRF')?.value || '';
  if (!value) return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(value);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isSameOrigin(req: Request): boolean {
  try {
    const url = new URL(req.url);
    const origin = (req.headers.get('origin') || '').toLowerCase();
    if (origin && origin !== 'null') return origin === `${url.protocol}//${url.host}`;
    const ref = (req.headers.get('referer') || '').toLowerCase();
    if (ref && ref !== 'null') {
      // Safely resolve relative/invalid refs against the request URL
      const r = new URL(ref, url);
      return r.protocol === url.protocol && r.host === url.host;
    }
  } catch {}
  return false;
}

export async function verifyCsrfForRequest(
  req: Request,
  value: string | null | undefined,
): Promise<boolean> {
  if (await verifyCsrfToken(value)) return true;
  // Fallback: accept when the request is same-origin
  if (isSameOrigin(req)) return true;
  return false;
}
