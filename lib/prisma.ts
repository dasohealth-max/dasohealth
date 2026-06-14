import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: true },
    // Keep pool size within Supabase PgBouncer limits.
    // Each Next.js worker opens its own Pool; 10 is safe for the free tier.
    max: 10,
    // Release idle connections after 30 s so PgBouncer isn't saturated between bursts.
    idleTimeoutMillis: 30_000,
    // Fail fast if a new connection cannot be acquired within 10 s.
    connectionTimeoutMillis: 10_000,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Preserve the singleton across HMR reloads in development.
// In production the module cache is stable so this branch never runs.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
