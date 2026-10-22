import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { games, gameRounds, players, songs } from "@/db/schema";
import { getGamesHistory } from "@/lib/data";

interface RoundPayload {
  position: number;
  songId: string;
  ownerId: string;
  guesserId: string;
  guessedId: string;
  correct: boolean;
}

export async function GET() {
  const history = await getGamesHistory(50);
  return NextResponse.json(history);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { rounds?: unknown }
    | null;

  if (!Array.isArray(body?.rounds) || body.rounds.length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const rounds = (body.rounds as RoundPayload[]).slice(0, 400).map((r, i) => ({
    position: typeof r.position === "number" ? r.position : i,
    songId: String(r.songId ?? ""),
    ownerId: String(r.ownerId ?? ""),
    guesserId: String(r.guesserId ?? ""),
    guessedId: String(r.guessedId ?? ""),
    correct: Boolean(r.correct),
  }));

  const songIds = [...new Set(rounds.map((r) => r.songId).filter(Boolean))];
  const playerIds = [
    ...new Set(
      rounds
        .flatMap((r) => [r.ownerId, r.guesserId, r.guessedId])
        .filter(Boolean),
    ),
  ];

  const songRows = songIds.length
    ? await db.select().from(songs).where(inArray(songs.id, songIds))
    : [];
  const playerRows = playerIds.length
    ? await db.select().from(players).where(inArray(players.id, playerIds))
    : [];

  const songMap = new Map(songRows.map((s) => [s.id, s]));
  const playerMap = new Map(playerRows.map((p) => [p.id, p]));

  const [game] = await db
    .insert(games)
    .values({ totalRounds: rounds.length })
    .returning();

  await db.insert(gameRounds).values(
    rounds.map((r) => {
      const song = songMap.get(r.songId);
      const owner = playerMap.get(r.ownerId);
      const guesser = playerMap.get(r.guesserId);
      const guessed = playerMap.get(r.guessedId);
      return {
        gameId: game.id,
        position: r.position,
        songId: song ? song.id : null,
        songTitle: song?.title ?? "Удалённый трек",
        songArtist: song?.artist ?? "",
        provider: song?.provider ?? "youtube",
        ownerId: owner?.id ?? null,
        ownerName: owner?.name ?? "?",
        ownerColor: owner?.color ?? "#FF2E88",
        guesserId: guesser?.id ?? null,
        guesserName: guesser?.name ?? "?",
        guesserColor: guesser?.color ?? "#22D3EE",
        guessedId: guessed?.id ?? null,
        guessedName: guessed?.name ?? "?",
        correct: r.correct,
      };
    }),
  );

  return NextResponse.json({ ok: true, gameId: game.id }, { status: 201 });
}
