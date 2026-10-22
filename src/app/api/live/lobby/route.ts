import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { players, songs } from "@/db/schema";
import { getOrCreateState, ONLINE_WINDOW_MS } from "@/lib/live";
import { toSongDTO } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId") ?? "";

  if (playerId) {
    await db
      .update(players)
      .set({ lastSeenAt: new Date() })
      .where(eq(players.id, playerId))
      .catch(() => undefined);
  }

  const [st, playerRows, songRows] = await Promise.all([
    getOrCreateState(),
    db.select().from(players).orderBy(asc(players.createdAt)),
    db.select().from(songs).orderBy(asc(songs.createdAt)),
  ]);

  const cutoff = Date.now() - ONLINE_WINDOW_MS;

  return NextResponse.json({
    serverNow: Date.now(),
    status: st.status,
    players: playerRows.map((p) => {
      const isSelf = p.id === playerId && playerId !== "";
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        online: Boolean(p.lastSeenAt && p.lastSeenAt.getTime() > cutoff),
        songCount: songRows.filter((s) => s.playerId === p.id).length,
        // Song details are private — only the owner ever receives them.
        songs: isSelf
          ? songRows.filter((s) => s.playerId === p.id).map(toSongDTO)
          : [],
      };
    }),
  });
}
