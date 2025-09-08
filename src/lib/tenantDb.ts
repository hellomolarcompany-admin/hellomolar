import { PrismaClient } from '@prisma/client';

type Cache = {
  byTenant: Map<string, PrismaClient>;
};

const globalForTenant = globalThis as unknown as { tenantDb?: Cache };

const cache: Cache = globalForTenant.tenantDb || { byTenant: new Map() };

export function getTenantPrisma(tenantId: string, dbUrl: string): PrismaClient {
  const existing = cache.byTenant.get(tenantId);
  if (existing) return existing;
  const client = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['warn', 'error'],
  });
  cache.byTenant.set(tenantId, client);
  if (process.env.NODE_ENV !== 'production') globalForTenant.tenantDb = cache;
  return client;
}
