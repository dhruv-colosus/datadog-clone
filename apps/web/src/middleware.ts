import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATH_PREFIXES = ["/auth/", "/public/"];
const AUTH_REDIRECT_PREFIXES = ["/auth/"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
  const shouldRedirectAuthed = AUTH_REDIRECT_PREFIXES.some((p) =>
    pathname.startsWith(p),
  );
  const hasToken = Boolean(request.cookies.get("access_token")?.value);

  if (!isPublic && !hasToken) {
    const url = new URL("/auth/sign-in", request.url);
    return NextResponse.redirect(url);
  }

  if (shouldRedirectAuthed && hasToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
