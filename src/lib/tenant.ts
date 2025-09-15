import { headers } from 'next/headers';

import { controlPrisma } from './controlPlane';
import { kmsDecryptBase64 } from './keys';
import { prisma as defaultPrisma } from './prisma';
import { getTenantPrisma } from './tenantDb';

export type TenantResolved = {
  id: string;
  slug: string;
  name: string;
  dbUrl: string;
  encKey: string;
  logoUrl?: string | null;
};

export function parseTenantFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.split(':')[0].toLowerCase();
  const parts = h.split('.');
  // Support both acme.example.com (>=3 parts) and acme.localhost (2 parts)
  if (parts.length >= 3) {
    const sub = parts[0];
    if (!sub || sub === 'www') return null;
    return sub;
  }
  if (parts.length === 2 && parts[1] === 'localhost') {
    const sub = parts[0];
    if (!sub || sub === 'www') return null;
    return sub;
  }
  return null;
}

export async function resolveTenant(): Promise<TenantResolved | null> {
  const hdrs = await headers();
  const host = hdrs.get('host');
  const slug = parseTenantFromHost(host);
  if (!slug) return null;

  // Look up in control plane
  const tenant = await controlPrisma.tenant.findUnique({
    where: { slug },
    include: { branding: true, secrets: true },
  });
  if (!tenant || !tenant.secrets) return null;

  const dbUrl = await kmsDecryptBase64(tenant.secrets.dbUrlCiphertext);
  const encKey = await kmsDecryptBase64(tenant.secrets.encKeyCiphertext);
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    dbUrl,
    encKey,
    logoUrl: tenant.branding?.logoUrl || null,
  };
}

export async function getTenantClient(): Promise<{
  info: TenantResolved;
  prisma: ReturnType<typeof getTenantPrisma>;
} | null> {
  const info = await resolveTenant();
  if (info) {
    const prisma = getTenantPrisma(info.id, info.dbUrl);
    return { info, prisma } as const;
  }
  // Single-tenant fallback: use default Prisma client and env key
  const dbUrl = process.env.DATABASE_URL || '';
  const encKey = process.env.INTAKE_ENC_KEY || '';
  if (!dbUrl || !encKey) return null;
  return {
    info: {
      id: 'single',
      slug: 'single',
      name: 'Single Tenant',
      dbUrl,
      encKey,
      logoUrl: null,
    },
    prisma: defaultPrisma as unknown as ReturnType<typeof getTenantPrisma>,
  } as const;
}
