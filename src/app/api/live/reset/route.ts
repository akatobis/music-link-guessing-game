import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { gameState, liveAnswers } from "@/db/schema";
import { GAME_STATE_ID, getOrCreateState } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function POST() {
  await getOrCreateState();
  await db.delete(liveAnswers);
  await db
    .update(gameState)
    .set({
      status: "lobby",
      roundIndex: 0,
      totalRounds: 0,
      roundOrder: [],
      phaseEndsAt: null,
      updatedAt: new Date(),
    })
    .where(eq(gameState.id, GAME_STATE_ID));
  return NextResponse.json({ ok: true });
}
