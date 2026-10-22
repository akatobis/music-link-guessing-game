import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { liveAnswers, players, songs } from "@/db/schema";
import {
  endRoundIfEveryoneAnswered,
  getOrCreateState,
  ownersOfSong,
  pointsFor,
  MAX_ROUND_S,
} from "@/lib/live";

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

  // The same track may have been added by several players — all of them are
  // "owners": they can't answer, and naming any of them is correct.
  const owners = await ownersOfSong(song);

  if (owners.has(playerId)) {
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

  const startMs = st.phaseEndsAt.getTime() - MAX_ROUND_S * 1000;
  const elapsedMs = Math.max(0, nowMs - startMs);
  const correct = owners.has(guessedPlayerId);
  const points = pointsFor(elapsedMs, correct);

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

  // Everyone answered? Then stop the music early and reveal.
  const after = await endRoundIfEveryoneAnswered(st);

  return NextResponse.json({
    ok: true,
    correct,
    points,
    elapsedMs: Math.round(elapsedMs),
    answersCount: count.length,
    roundClosed: after.status === "reveal",
  });
}
