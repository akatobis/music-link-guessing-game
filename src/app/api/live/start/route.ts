import { NextResponse } from "next/server";
import { db } from "@/db";
import { gameState, liveAnswers, players, songs } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  COUNTDOWN_S,
  GAME_STATE_ID,
  getOrCreateState,
  shuffleArray,
} from "@/lib/live";

export const dynamic = "force-dynamic";

export async function POST() {
  const st = await getOrCreateState();
  if (st.status !== "lobby" && st.status !== "finished") {
    return NextResponse.json({ error: "already_running" }, { status: 409 });
  }

  const playerRows = await db.select().from(players);
  const songRows = await db.select().from(songs);
  const readyPlayers = playerRows.filter((p) =>
    songRows.some((s) => s.playerId === p.id),
  );

  if (playerRows.length < 2) {
    return NextResponse.json({ error: "need_players" }, { status: 422 });
  }
  if (readyPlayers.length !== playerRows.length) {
    return NextResponse.json({ error: "need_songs" }, { status: 422 });
  }
  if (songRows.length === 0) {
    return NextResponse.json({ error: "need_songs" }, { status: 422 });
  }

  const order = shuffleArray(songRows.map((s) => s.id));
  const now = new Date();

  await db.delete(liveAnswers);
  await db
    .update(gameState)
    .set({
      status: "countdown",
      roundIndex: 0,
      totalRounds: order.length,
      roundOrder: order,
      phaseEndsAt: new Date(now.getTime() + COUNTDOWN_S * 1000),
      updatedAt: now,
    })
    .where(eq(gameState.id, GAME_STATE_ID));

  return NextResponse.json({ ok: true, totalRounds: order.length });
}
