import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { canAccess, defaultPathForRole, type AppModule } from '@/lib/permissions';

const PROTECTED = [
  '/dashboard',
  '/patients',
  '/campaigns',
  '/followups',
  '/reports',
  '/screening',
  '/settings',
  '/surgeries',
];

const ROUTE_MODULES: { path: string; module: AppModule }[] = [
  { path: '/dashboard', module: 'dashboard' },
  { path: '/campaigns', module: 'campaigns' },
  { path: '/patients', module: 'patients' },
  { path: '/screening', module: 'screening' },
  { path: '/surgeries', module: 'surgeries' },
  { path: '/followups', module: 'followups' },
  { path: '/reports', module: 'reports' },
  { path: '/settings', module: 'settings' },
];

function matches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + '/');
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((path) => matches(pathname, path));
  const shouldCheckUser = isProtected || pathname === '/login';
  if (!shouldCheckUser) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (error) {
    console.error('Supabase auth check failed in proxy', error);
  }

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtected && user) {
    const role = String(user.app_metadata?.role ?? user.user_metadata?.role ?? '');
    const current = ROUTE_MODULES.find((route) => matches(pathname, route.path));

    if (current && !canAccess(role, current.module)) {
      return NextResponse.redirect(new URL(defaultPathForRole(role), request.url));
    }
  }

  if (pathname === '/login' && user) {
    const role = String(user.app_metadata?.role ?? user.user_metadata?.role ?? '');
    return NextResponse.redirect(new URL(defaultPathForRole(role), request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
