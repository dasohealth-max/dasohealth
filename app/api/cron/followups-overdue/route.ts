import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { checkAndMarkOverdue } from '@/lib/api/follow_ups';

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
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: 'Cron secret is not configured' }, { status: 500 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const updated = await checkAndMarkOverdue();
  revalidateTag('follow-ups', 'max');

  return NextResponse.json({
    ok: true,
    updated,
    checkedAt: new Date().toISOString(),
  });
}
