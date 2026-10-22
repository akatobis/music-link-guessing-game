import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { liveAnswers, players, songs } from "@/db/schema";
import {
  advanceIfNeeded,
  getOrCreateState,
  snippetFraction,
  COUNTDOWN_S,
  WINDOW_S,
  REVEAL_S,
  ONLINE_WINDOW_MS,
} from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId") ?? "";

  // heartbeat → online presence
  if (playerId) {
    await db
      .update(players)
      .set({ lastSeenAt: new Date() })
      .where(eq(players.id, playerId))
      .catch(() => undefined);
  }

  let st = await getOrCreateState();
  st = await advanceIfNeeded(st);

  const nowMs = Date.now();
  const playerRows = await db
    .select()
    .from(players)
    .orderBy(asc(players.createdAt));
  const playerMap = new Map(playerRows.map((p) => [p.id, p]));
  const onlineCutoff = nowMs - ONLINE_WINDOW_MS;
  const onlineCount = playerRows.filter(
    (p) => p.lastSeenAt && p.lastSeenAt.getTime() > onlineCutoff,
  ).length;

  const answerRows = await db.select().from(liveAnswers);

  const scores = playerRows
    .map((p) => ({ playerId: p.id, name: p.name, color: p.color, points: 0 }))
    .sort((a, b) => b.points - a.points);
  const scoreMap = new Map(scores.map((s) => [s.playerId, s]));
  for (const a of answerRows) {
    const s = scoreMap.get(a.playerId);
    if (s) s.points += a.points;
  }

  const base = {
    serverNow: nowMs,
    status: st.status,
    roundIndex: st.roundIndex,
    totalRounds: st.totalRounds,
    phaseEndsAt: st.phaseEndsAt?.getTime() ?? null,
    countdownS: COUNTDOWN_S,
    windowS: WINDOW_S,
    revealS: REVEAL_S,
    scores,
    players: playerRows.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    onlineCount,
    playersCount: playerRows.length,
    meValid: playerMap.has(playerId),
    song: null as null | {
      id: string;
      provider: string;
      providerId: string;
      albumId: string | null;
      embedUrl: string;
      fraction: number;
    },
    songInfo: null as null | {
      title: string;
      artist: string;
      thumbnail: string | null;
      ownerId: string;
      ownerName: string;
      ownerColor: string;
    },
    isOwner: false,
    myAnswer: null as null | {
      guessedPlayerId: string | null;
      correct: boolean;
      points: number;
      elapsedMs: number;
    },
    answersCount: 0,
    eligible: 0,
    guesses: null as null | {
      guesserId: string;
      guesserName: string;
      guesserColor: string;
      guessedId: string | null;
      guessedName: string;
      correct: boolean;
      points: number;
      elapsedMs: number;
    }[],
  };

  const inGame =
    st.status === "countdown" ||
    st.status === "playing" ||
    st.status === "reveal";
  if (!inGame || st.roundOrder.length === 0) {
    return NextResponse.json(base);
  }

  const songId = st.roundOrder[st.roundIndex];
  const [song] = await db.select().from(songs).where(eq(songs.id, songId));
  if (!song) {
    return NextResponse.json(base);
  }

  const roundAnswers = answerRows.filter((a) => a.songId === songId);
  const mine = roundAnswers.find((a) => a.playerId === playerId);
  const owner = playerMap.get(song.playerId);

  base.song = {
    id: song.id,
    provider: song.provider,
    providerId: song.providerId,
    albumId: song.albumId,
    embedUrl: song.embedUrl,
    fraction: snippetFraction(song.id),
  };
  base.isOwner = song.playerId === playerId;
  base.answersCount = roundAnswers.length;
  base.eligible = Math.max(playerRows.length - 1, 1);
  base.myAnswer = mine
    ? {
        guessedPlayerId: mine.guessedPlayerId,
        correct: mine.correct,
        points: mine.points,
        elapsedMs: mine.elapsedMs,
      }
    : null;

  if (st.status === "reveal") {
    base.songInfo = {
      title: song.title,
      artist: song.artist,
      thumbnail: song.thumbnail,
      ownerId: song.playerId,
      ownerName: owner?.name ?? "?",
      ownerColor: owner?.color ?? "#FF2E88",
    };
    base.guesses = roundAnswers
      .map((a) => {
        const guesser = playerMap.get(a.playerId);
        const guessed = a.guessedPlayerId
          ? playerMap.get(a.guessedPlayerId)
          : undefined;
        return {
          guesserId: a.playerId,
          guesserName: guesser?.name ?? "?",
          guesserColor: guesser?.color ?? "#fff",
          guessedId: a.guessedPlayerId,
          guessedName: guessed?.name ?? "—",
          correct: a.correct,
          points: a.points,
          elapsedMs: a.elapsedMs,
        };
      })
      .sort((a, b) => a.elapsedMs - b.elapsedMs);
  }

  return NextResponse.json(base);
}
