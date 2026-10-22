import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players } from "@/db/schema";

const globalAttempts = globalThis as typeof globalThis & {
  __claimAttempts?: Map<string, { n: number; resetAt: number }>;
};
const attempts = (globalAttempts.__claimAttempts ??= new Map());

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 30_000;

function registerAttempt(id: string): { blocked: boolean } {
  const now = Date.now();
  const a = attempts.get(id);
  if (a && now < a.resetAt && a.n >= MAX_ATTEMPTS) return { blocked: true };
  if (!a || now >= a.resetAt) {
    attempts.set(id, { n: 1, resetAt: now + WINDOW_MS });
  } else {
    a.n += 1;
  }
  return { blocked: false };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { playerId?: unknown; pin?: unknown }
    | null;
  const playerId = typeof body?.playerId === "string" ? body.playerId : "";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

  if (!playerId || !pin) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (registerAttempt(playerId).blocked) {
    return NextResponse.json({ error: "too_many" }, { status: 429 });
  }

  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId));
  if (!player) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Players created without a PIN (legacy) can be claimed with 0000.
  const expected = player.pin ?? "0000";
  if (pin !== expected) {
    return NextResponse.json({ error: "wrong_pin" }, { status: 403 });
  }

  await db
    .update(players)
    .set({ lastSeenAt: new Date() })
    .where(eq(players.id, playerId));

  return NextResponse.json({ ok: true });
}
