import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "ev_diag_auth";
const AUTH_MESSAGE = "ev-diag-auth";

async function getExpectedToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(AUTH_MESSAGE)
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function middleware(request: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  // Never gate API routes: ESP32 and other clients use /api/ingest, /api/sessions, etc.
  // with API key only; they do not send the web login cookie.
  if (path.startsWith("/api/") || path.startsWith("/_next") || path.startsWith("/login")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const expected = await getExpectedToken(sitePassword);
  if (cookie === expected) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", path);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
