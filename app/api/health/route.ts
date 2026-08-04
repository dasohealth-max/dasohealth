import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      database: 'reachable',
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({
      ok: false,
      database: 'unreachable',
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
