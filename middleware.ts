import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 1. Clone request headers so we can securely inject data later
  const requestHeaders = new Headers(request.headers);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 2. Initialize the Supabase Server Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // 3. SECURE CHECK: Use getUser() instead of getSession() to prevent spoofing
  const { data: { user } } = await supabase.auth.getUser();

  // 4. Define protected routes
  const protectedPaths = ['/dashboard', '/lesson', '/assessment', '/doubts', '/profile', '/onboarding'];
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  const apiProtectedPaths = ['/api/curriculum', '/api/lesson', '/api/assessment', '/api/doubts', '/api/profile'];
  const isApiProtected = apiProtectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

  // 5. SECURITY RULES
  
  // Rule A: Not logged in? Redirect to the root ("/") instead of login page.
  if ((isProtectedPath || isApiProtected) && !user) {
    // Redirect to the root homepage
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Rule B: Already logged in? Keep them away from auth screens ONLY.
  if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Rule C: Inject User Data into API Requests
  if (user && isApiProtected) {
    requestHeaders.set('x-user-id', user.id);
    if (user.email) {
      requestHeaders.set('x-user-email', user.email);
    }
    // Update the response with the modified request headers
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};