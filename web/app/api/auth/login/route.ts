import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const AUTH_COOKIE_NAME = "ev_diag_auth";
const AUTH_MESSAGE = "ev-diag-auth";

function getAuthToken(password: string): string {
  return createHmac("sha256", password)
    .update(AUTH_MESSAGE)
    .digest("base64url");
}

export async function POST(request: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return NextResponse.json(
      { error: "Site password not configured" },
      { status: 503 }
    );
  }

  const body = await request.json();
  const password = typeof body?.password === "string" ? body.password : "";
  if (password !== sitePassword) {
    return NextResponse.json({ error: "Password errata" }, { status: 401 });
  }

  const token = getAuthToken(sitePassword);
  const rawFrom =
    (typeof body?.from === "string" ? body.from : null) ||
    request.nextUrl.searchParams.get("from") ||
    "/";
  const redirect =
    rawFrom.startsWith("/") && !rawFrom.startsWith("//") ? rawFrom : "/";
  const res = NextResponse.json({ ok: true, redirect });
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
