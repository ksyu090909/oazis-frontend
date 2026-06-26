import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const publicKey = request.nextUrl.searchParams.get("url");
  if (!publicKey) return NextResponse.json({ error: "No url" }, { status: 400 });

  const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicKey)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) return NextResponse.json({ error: "Yandex error" }, { status: 502 });

  const { href } = await res.json();
  return NextResponse.json({ href });
}
