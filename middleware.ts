import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// All route segments that live inside app/(dashboard)/
const PROTECTED = [
  '/dashboard', '/patients', '/campaigns', '/followups', '/inventory',
  '/locations', '/outreach', '/referrals', '/reports', '/screening',
  '/settings', '/surgeries', '/transport',
];

export async function middleware(request: NextRequest) {
  // Start with a plain pass-through response; setAll will replace it if
  // any session cookies need to be updated (token refresh).
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write the new cookie values into the outgoing request so that
          // subsequent server code sees them, then rebuild the response so
          // the browser receives the updated Set-Cookie headers.
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

  // getSession() also silently refreshes an expiring access token.
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  // Run on every route except Next.js internals and static files.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
