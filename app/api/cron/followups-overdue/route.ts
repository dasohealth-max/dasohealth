import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { checkAndMarkOverdue } from '@/lib/api/follow_ups';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBearerToken(header: string | null): string {
  if (!header?.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const bearer = getBearerToken(request.headers.get('authorization'));
  const headerSecret = request.headers.get('x-cron-secret') ?? '';
  return bearer === secret || headerSecret === secret;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Cron secret is not configured' }, { status: 500 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const count = await checkAndMarkOverdue({}, tx);
      await tx.auditLog.create({
        data: {
          actor: 'System (Scheduled Job)',
          actorId: 'system:followups-overdue',
          actorName: 'Scheduled Job',
          actorRole: 'System',
          action: 'refresh_statuses',
          entity: 'FollowUp',
          entityId: 'batch',
          details: `Refreshed follow-up statuses; ${count} rows updated`,
        },
      });
      return count;
    });
    revalidateTag('follow-ups', 'max');

    return NextResponse.json({
      ok: true,
      updated,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('Follow-up overdue cron failed', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      ok: false,
      error: 'Follow-up status refresh failed',
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    }, { status: 500 });
  }
}
