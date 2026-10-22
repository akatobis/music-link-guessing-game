import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { liveAnswers, players, songs } from "@/db/schema";
import { getOrCreateState, pointsFor, WINDOW_S } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { playerId?: unknown; guessedPlayerId?: unknown }
    | null;
  const playerId = typeof body?.playerId === "string" ? body.playerId : "";
  const guessedPlayerId =
    typeof body?.guessedPlayerId === "string" ? body.guessedPlayerId : "";

  if (!playerId || !guessedPlayerId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const st = await getOrCreateState();
  if (st.status !== "playing" || !st.phaseEndsAt) {
    return NextResponse.json({ error: "not_playing" }, { status: 409 });
  }

  const nowMs = Date.now();
  if (nowMs >= st.phaseEndsAt.getTime()) {
    return NextResponse.json({ error: "too_late" }, { status: 410 });
  }

  const songId = st.roundOrder[st.roundIndex];
  const [song] = await db.select().from(songs).where(eq(songs.id, songId));
  if (!song) {
    return NextResponse.json({ error: "no_song" }, { status: 409 });
  }

  const [me] = await db.select().from(players).where(eq(players.id, playerId));
  if (!me) {
    return NextResponse.json({ error: "no_player" }, { status: 404 });
  }

  if (song.playerId === playerId) {
    return NextResponse.json({ error: "own_song" }, { status: 403 });
  }

  const existing = await db
    .select({ id: liveAnswers.id })
    .from(liveAnswers)
    .where(
      and(
        eq(liveAnswers.songId, songId),
        eq(liveAnswers.playerId, playerId),
      ),
    );
  if (existing.length > 0) {
    return NextResponse.json({ error: "already" }, { status: 409 });
  }

  const startMs = st.phaseEndsAt.getTime() - WINDOW_S * 1000;
  const elapsedMs = Math.max(0, nowMs - startMs);
  const correct = guessedPlayerId === song.playerId;
  const points = pointsFor(elapsedMs, WINDOW_S * 1000, correct);

  await db.insert(liveAnswers).values({
    songId,
    playerId,
    guessedPlayerId,
    correct,
    points,
    elapsedMs: Math.round(elapsedMs),
  });

  const count = await db
    .select({ id: liveAnswers.id })
    .from(liveAnswers)
    .where(eq(liveAnswers.songId, songId));

  return NextResponse.json({
    ok: true,
    correct,
    points,
    elapsedMs: Math.round(elapsedMs),
    answersCount: count.length,
  });
}
