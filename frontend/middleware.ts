import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Public routes that don't need authentication
  const publicRoutes = [
    '/',
    '/auth/login',
    '/auth/signup/landlord',
    '/auth/signup/tenant',
    '/demo',
    '/properties',
  ];

  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname === route || 
    request.nextUrl.pathname.startsWith('/auth/') ||
    request.nextUrl.pathname.startsWith('/demo') ||
    request.nextUrl.pathname.startsWith('/properties')
  );

  // If not authenticated and trying to access protected route
  if (!session && !isPublicRoute) {
    console.log('Middleware: No session, redirecting to login from', request.nextUrl.pathname);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/auth/login';
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If authenticated, get user role
  if (session) {
    const { data: authUser } = await supabase
      .from('auth_users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (authUser) {
      // Redirect to appropriate dashboard if accessing root
      if (request.nextUrl.pathname === '/') {
        if (authUser.role === 'landlord') {
          return NextResponse.redirect(new URL('/landlord/dashboard', request.url));
        } else if (authUser.role === 'tenant') {
          return NextResponse.redirect(new URL('/tenant/dashboard', request.url));
        }
      }

      // Protect landlord routes
      if (request.nextUrl.pathname.startsWith('/landlord/') && authUser.role !== 'landlord') {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }

      // Protect tenant routes
      if (request.nextUrl.pathname.startsWith('/tenant/') && authUser.role !== 'tenant') {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
      }

      // Redirect authenticated users away from auth pages (but not /properties)
      if (isPublicRoute && request.nextUrl.pathname !== '/' && !request.nextUrl.pathname.startsWith('/properties')) {
        if (authUser.role === 'landlord') {
          return NextResponse.redirect(new URL('/landlord/dashboard', request.url));
        } else if (authUser.role === 'tenant') {
          return NextResponse.redirect(new URL('/tenant/dashboard', request.url));
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};