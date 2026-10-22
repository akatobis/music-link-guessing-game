import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { gameState, liveAnswers, players, songs, games, gameRounds } from "@/db/schema";
import type { GameStateRow } from "@/db/schema";

export const GAME_STATE_ID = "main";
export const COUNTDOWN_S = 5;
export const WINDOW_S = 30;
export const REVEAL_S = 8;
export const ONLINE_WINDOW_MS = 12_000;

export function secondsFor(status: string): number {
  switch (status) {
    case "countdown":
      return COUNTDOWN_S;
    case "playing":
      return WINDOW_S;
    case "reveal":
      return REVEAL_S;
    default:
      return 0;
  }
}

export async function getOrCreateState(): Promise<GameStateRow> {
  const [existing] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.id, GAME_STATE_ID));
  if (existing) return existing;
  const [created] = await db
    .insert(gameState)
    .values({ id: GAME_STATE_ID })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db
    .select()
    .from(gameState)
    .where(eq(gameState.id, GAME_STATE_ID));
  return again;
}

/**
 * Lazily advances the shared state machine based on phase deadlines.
 * Conditional UPDATEs make concurrent pollers race-safe: only the first
 * request actually performs the transition.
 */
export async function advanceIfNeeded(
  st: GameStateRow,
): Promise<GameStateRow> {
  if (!st.phaseEndsAt || st.status === "lobby" || st.status === "finished") {
    return st;
  }
  const now = new Date();
  if (now.getTime() < st.phaseEndsAt.getTime()) return st;

  if (st.status === "countdown") {
    const res = await db
      .update(gameState)
      .set({
        status: "playing",
        phaseEndsAt: new Date(now.getTime() + WINDOW_S * 1000),
        updatedAt: now,
      })
      .where(
        and(eq(gameState.id, GAME_STATE_ID), eq(gameState.status, "countdown")),
      )
      .returning();
    return res[0] ?? st;
  }

  if (st.status === "playing") {
    const res = await db
      .update(gameState)
      .set({
        status: "reveal",
        phaseEndsAt: new Date(now.getTime() + REVEAL_S * 1000),
        updatedAt: now,
      })
      .where(
        and(eq(gameState.id, GAME_STATE_ID), eq(gameState.status, "playing")),
      )
      .returning();
    return res[0] ?? st;
  }

  if (st.status === "reveal") {
    if (st.roundIndex + 1 < st.totalRounds) {
      const res = await db
        .update(gameState)
        .set({
          status: "countdown",
          roundIndex: st.roundIndex + 1,
          phaseEndsAt: new Date(now.getTime() + COUNTDOWN_S * 1000),
          updatedAt: now,
        })
        .where(
          and(eq(gameState.id, GAME_STATE_ID), eq(gameState.status, "reveal")),
        )
        .returning();
      return res[0] ?? st;
    }

    const res = await db
      .update(gameState)
      .set({ status: "finished", phaseEndsAt: null, updatedAt: now })
      .where(
        and(eq(gameState.id, GAME_STATE_ID), eq(gameState.status, "reveal")),
      )
      .returning();
    if (res[0]) {
      // Exactly one request wins this race — persist the game to history.
      await persistFinishedGame(st).catch(() => undefined);
    }
    return res[0] ?? st;
  }

  return st;
}

async function persistFinishedGame(st: GameStateRow) {
  const order = st.roundOrder ?? [];
  if (order.length === 0) return;

  const songRows = await db.select().from(songs);
  const playerRows = await db.select().from(players);
  const answerRows = await db.select().from(liveAnswers);
  if (answerRows.length === 0) return;

  const songMap = new Map(songRows.map((s) => [s.id, s]));
  const playerMap = new Map(playerRows.map((p) => [p.id, p]));

  const [game] = await db
    .insert(games)
    .values({ totalRounds: order.length })
    .returning();

  const rows = answerRows
    .map((a) => {
      const position = order.indexOf(a.songId);
      if (position < 0) return null;
      const song = songMap.get(a.songId);
      const owner = song ? playerMap.get(song.playerId) : undefined;
      const guesser = playerMap.get(a.playerId);
      const guessed = a.guessedPlayerId
        ? playerMap.get(a.guessedPlayerId)
        : undefined;
      return {
        gameId: game.id,
        position,
        songId: song?.id ?? null,
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
        guessedName: guessed?.name ?? "—",
        points: a.points,
        correct: a.correct,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) {
    await db.insert(gameRounds).values(rows);
  }
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministic per-song playback offset (10–70% of duration). */
export function snippetFraction(songId: string): number {
  let h = 0;
  for (let i = 0; i < songId.length; i++) {
    h = (h * 31 + songId.charCodeAt(i)) >>> 0;
  }
  return 0.1 + (h % 60) / 100;
}

export function pointsFor(elapsedMs: number, windowMs: number, correct: boolean) {
  if (!correct) return 0;
  const t = Math.min(Math.max(elapsedMs, 0), windowMs);
  return 100 + Math.round(50 * (1 - t / windowMs));
}

export type LiveStatus =
  | "lobby"
  | "countdown"
  | "playing"
  | "reveal"
  | "finished";
