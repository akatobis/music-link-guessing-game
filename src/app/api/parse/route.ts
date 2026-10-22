import { NextResponse } from "next/server";
import { parseMusicLink } from "@/lib/providers";
import { resolveMetadata } from "@/lib/metadata";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url : "";

  if (!url.trim()) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const parsed = parseMusicLink(url);
  if (!parsed) {
    return NextResponse.json({ error: "unsupported" }, { status: 422 });
  }

  const meta = await resolveMetadata(parsed);
  return NextResponse.json({ ...parsed, ...meta });
}
