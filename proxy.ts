import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const userType = request.cookies.get('user_type')?.value;

  const { pathname } = request.nextUrl;

  // Define valid routes
  const validRoutes = [
    '/',
    '/club',
    '/event',
    '/not-found',
    '/admin/login',
    '/admin/signup',
    '/admin/home',
    '/admin/clubs',
    '/admin/players',
    '/admin/users',
    '/admin/events',
    '/player/login',
    '/player/signup',
    '/player/profile',
  ];

  // Check if route is valid (including dynamic routes)
  const isValidRoute = 
    validRoutes.includes(pathname) || 
    /^\/player\/profile\/[^/]+$/.test(pathname);

  if (!isValidRoute) {
    return NextResponse.redirect(new URL('/not-found', request.url));
  }

  // Admin Routes
  if (pathname.startsWith('/admin')) {
    // Allow access to login/signup pages
    if (pathname === '/admin/login' || pathname === '/admin/signup') {
        if (token) {
            if (userType === 'admin') {
                return NextResponse.redirect(new URL('/admin/home', request.url));
            } else if (userType === 'player') {
                return NextResponse.redirect(new URL('/', request.url));
            }
        }
        return NextResponse.next();
    }

    // Protect other admin routes
    if (!token || userType !== 'admin') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Player Routes (Login/Signup)
  if (pathname === '/player/login' || pathname === '/player/signup') {
      if (token) {
          if (userType === 'player') {
              return NextResponse.redirect(new URL('/', request.url));
          } else if (userType === 'admin') {
              return NextResponse.redirect(new URL('/admin/home', request.url));
          }
      }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
