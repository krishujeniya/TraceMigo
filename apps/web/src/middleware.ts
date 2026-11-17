import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/workspace",
  "/history",
  "/settings",
  "/billing",
  "/admin",
];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  if (isProtected) {
    const sessionCookie = request.cookies.get("tracemigo_session");
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("returnTo", pathname + search);
      return NextResponse.redirect(loginUrl);
    }

    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/workspace/:path*",
    "/history/:path*",
    "/history",
    "/settings/:path*",
    "/settings",
    "/billing/:path*",
    "/billing",
    "/admin/:path*",
  ],
};
