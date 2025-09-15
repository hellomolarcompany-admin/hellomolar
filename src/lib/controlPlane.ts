import { PrismaClient } from '@prisma/client';

// Dedicated Prisma client targeting the control-plane database.
// Models are defined in prisma_control/schema.prisma but also mirrored in
// prisma/schema.prisma, so the generated types are compatible.
// This client points at CONTROL_DATABASE_URL (falling back to DATABASE_URL).

const globalForControl = globalThis as unknown as { controlPrisma?: PrismaClient };

export const controlPrisma =
  globalForControl.controlPrisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.CONTROL_DATABASE_URL || process.env.DATABASE_URL || '',
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForControl.controlPrisma = controlPrisma;
