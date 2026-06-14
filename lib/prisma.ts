import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function buildConnectionString(rawUrl: string) {
  const url = new URL(rawUrl);
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';

  url.searchParams.set('sslmode', rejectUnauthorized ? 'require' : 'no-verify');
  return url.toString();
}

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to connect to the production database.');
  }

  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';
  const adapter = new PrismaPg({
    connectionString: buildConnectionString(process.env.DATABASE_URL),
    ssl: { rejectUnauthorized },
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
