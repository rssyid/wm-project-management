import { NextResponse, type NextRequest } from "next/server";

// docs/02 §4: proxy hanya mengecek keberadaan cookie untuk redirect cepat. Validasi session
// tetap dilakukan tiap halaman dan endpoint; cookie ini bukan bukti login yang sah, dan
// endpoint menjawab 401 sendiri supaya pemanggil API mendapat JSON, bukan halaman login.
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

const PUBLIC_PATHS = ["/login", "/ubah-password"];

function hasSessionCookie(request: NextRequest): boolean {
  const cookies = request.cookies;
  return SESSION_COOKIES.some((name) => Boolean(cookies.get(name)?.value));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (
    pathname.startsWith("/api") ||
    PUBLIC_PATHS.some((path) => pathname.startsWith(path))
  ) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
