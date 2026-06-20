import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let Next.js assets and favicon pass through directly
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // Get session token from cookie
  const token = request.cookies.get('token')?.value;

  if (!token) {
    // Allow public routes
    if (
      pathname === '/login' ||
      pathname === '/onboard' ||
      (pathname === '/api/contacts' && request.method === 'POST') ||
      pathname.startsWith('/api/auth') ||
      pathname.startsWith('/portal') ||
      pathname.startsWith('/api/portal') ||
      pathname.startsWith('/invoice-print/') ||
      (pathname.startsWith('/api/invoices/') && request.method === 'GET')
    ) {
      return NextResponse.next();
    }
    console.warn(`[PROXY NO TOKEN] Redirecting to /login from path: ${pathname}`);
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Parse token payload safely
  let user: { id: string; email: string; role: string; name: string; exp: number } | null = null;
  let parseError: any = null;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadStr = parts[1];
      const decodedPayload = decodeBase64Url(payloadStr);
      user = JSON.parse(decodedPayload);
    } else {
      parseError = `Token parts mismatch: ${parts.length}`;
    }
  } catch (e: any) {
    user = null;
    parseError = e.message || e;
  }

  if (!user) {
    console.warn(`[PROXY AUTH FAILURE] Path: ${pathname} | Error: ${parseError} | Token prefix: ${token?.slice(0, 15)}`);
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  }

  // Check expiration
  if (user.exp && Date.now() / 1000 > user.exp) {
    console.warn(`[PROXY EXPIRED TOKEN] Expired at: ${user.exp} | Current time: ${Date.now() / 1000}`);
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  }

  // Role-based Restrictions:
  // VIEWER is read-only. Block non-GET API requests (excluding auth)
  if (user.role === 'VIEWER') {
    if (request.method !== 'GET' && pathname.startsWith('/api/')) {
      if (!pathname.startsWith('/api/auth') && !pathname.startsWith('/api/portal/')) {
        // Permit public onboarding even if a viewer session cookie is active
        if (pathname === '/api/contacts' && request.method === 'POST' && request.headers.get('x-user-role') === 'FOUNDER') {
          // Allow onboarding POST
        } else {
          return new NextResponse(
            JSON.stringify({ error: 'Permission denied. Viewer role is read-only.' }),
            {
              status: 403,
              headers: { 'content-type': 'application/json' },
            }
          );
        }
      }
    }
  }

  // Only FOUNDER has access to /admin or /api/admin
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (user.role !== 'FOUNDER') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // Only FOUNDER and ACCOUNTANT have access to /import or /api/import
  if (pathname.startsWith('/import') || pathname.startsWith('/api/import')) {
    if (user.role !== 'FOUNDER' && user.role !== 'ACCOUNTANT') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // Set user headers to pass user context to downstream API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.id);
  requestHeaders.set('x-user-email', user.email);
  if (pathname === '/api/contacts' && request.method === 'POST' && request.headers.get('x-user-role') === 'FOUNDER') {
    requestHeaders.set('x-user-role', 'FOUNDER');
  } else {
    requestHeaders.set('x-user-role', user.role);
  }
  requestHeaders.set('x-user-name', user.name);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for login/logout endpoints and next static assets
     */
    '/((?!api/auth/login|api/auth/logout|api/auth/portal-login|_next/static|_next/image|favicon.ico).*)',
  ],
};
