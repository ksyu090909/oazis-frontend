import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set("oazis_session", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
