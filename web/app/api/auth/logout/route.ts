import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "ev_diag_auth";

export async function POST(request: NextRequest) {
  const url = request.nextUrl.origin + "/login";
  const res = NextResponse.redirect(url);
  res.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
