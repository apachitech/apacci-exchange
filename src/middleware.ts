import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, decodeSessionCookie } from "@/lib/auth-session";

const PROTECTED_PATHS = [
  "/send",
  "/recipients",
  "/transactions",
  "/profile",
  "/admin",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const rawCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = decodeSessionCookie(rawCookie);

  // 1. Not logged in -> Redirect to /login?next=<pathname>
  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/send/:path*",
    "/recipients/:path*",
    "/transactions/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
};

