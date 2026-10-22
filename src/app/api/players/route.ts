import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";
import { MAX_PLAYERS } from "@/lib/providers";

function toPublic(p: typeof players.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    lastSeenAt: p.lastSeenAt,
    createdAt: p.createdAt,
  };
}

export async function GET() {
  const rows = await db.select().from(players).orderBy(asc(players.createdAt));
  return NextResponse.json(rows.map(toPublic));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { name?: unknown; color?: unknown; pin?: unknown }
    | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const color = typeof body?.color === "string" ? body.color : "#FF2E88";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "empty_name" }, { status: 400 });
  }
  if (name.length > 24) {
    return NextResponse.json({ error: "name_too_long" }, { status: 400 });
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return NextResponse.json({ error: "bad_color" }, { status: 400 });
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "bad_pin" }, { status: 400 });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(players);
  if (count >= MAX_PLAYERS) {
    return NextResponse.json({ error: "players_limit" }, { status: 422 });
  }

  const existing = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(sql`lower(${players.name})`, name.toLowerCase()));
  if (existing.length > 0) {
    return NextResponse.json({ error: "duplicate_name" }, { status: 409 });
  }

  const [created] = await db
    .insert(players)
    .values({ name, color, pin, lastSeenAt: new Date() })
    .returning();
  return NextResponse.json(toPublic(created), { status: 201 });
}
