import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function middleware(request: NextRequest) {
  const url = request.nextUrl;
  
  if (url.hostname === 'simple-invoicing.kdmp.workers.dev') {
    url.hostname = 'simple-invoicing.biz.id';
    // redirect to the new url preserving path and query string
    return NextResponse.redirect(url, 301);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
  runtime: 'experimental-edge',
};
