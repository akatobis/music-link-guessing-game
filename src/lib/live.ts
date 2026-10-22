import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { gameState, liveAnswers, players, songs, games, gameRounds } from "@/db/schema";
import type { GameStateRow } from "@/db/schema";

export const GAME_STATE_ID = "main";
export const COUNTDOWN_S = 5;
/** Safety cap: a round can never hang longer than this (track plays on). */
export const MAX_ROUND_S = 480;
export const REVEAL_S = 8;
/** Speed bonus fades out over the first minute of the round. */
export const SPEED_REF_MS = 60_000;
export const ONLINE_WINDOW_MS = 12_000;

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
        phaseEndsAt: new Date(now.getTime() + MAX_ROUND_S * 1000),
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
  const ownerIndex = buildOwnerIndex(songRows);

  const [game] = await db
    .insert(games)
    .values({ totalRounds: order.length })
    .returning();

  const rows = answerRows
    .map((a) => {
      const position = order.indexOf(a.songId);
      if (position < 0) return null;
      const song = songMap.get(a.songId);
      const ownerIds = song
        ? [...(ownerIndex.get(songKey(song)) ?? new Set([song.playerId]))]
        : [];
      const owners = ownerIds
        .map((id) => playerMap.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p));
      const owner = owners[0];
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
        ownerName:
          owners.length > 1
            ? owners.map((o) => o.name).join(" + ")
            : (owner?.name ?? "?"),
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

/**
 * Canonical identity of a track across players: the same YouTube video /
 * Spotify track / Yandex track added by several people is ONE track.
 */
export function songKey(s: { provider: string; providerId: string }) {
  return `${s.provider}:${s.providerId}`;
}

/** key -> set of player ids who added that track */
export function buildOwnerIndex(
  rows: { provider: string; providerId: string; playerId: string }[],
) {
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = songKey(r);
    const set = map.get(k) ?? new Set<string>();
    set.add(r.playerId);
    map.set(k, set);
  }
  return map;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pointsFor(elapsedMs: number, correct: boolean) {
  if (!correct) return 0;
  const t = Math.min(Math.max(elapsedMs, 0), SPEED_REF_MS);
  return 100 + Math.round(50 * (1 - t / SPEED_REF_MS));
}

/** Players expected to answer the current round: online, minus track owners. */
export function eligibleAnswerers(
  playerRows: { id: string; lastSeenAt: Date | null }[],
  ownerIds: Set<string>,
  nowMs: number,
): string[] {
  const online = playerRows.filter(
    (p) =>
      !ownerIds.has(p.id) &&
      p.lastSeenAt &&
      p.lastSeenAt.getTime() > nowMs - ONLINE_WINDOW_MS,
  );
  if (online.length > 0) return online.map((p) => p.id);
  // Nobody is online right now — fall back to everyone who isn't an owner.
  return playerRows.filter((p) => !ownerIds.has(p.id)).map((p) => p.id);
}

/** Owners of the round's track (same song added by several people). */
export async function ownersOfSong(song: {
  provider: string;
  providerId: string;
  playerId: string;
}): Promise<Set<string>> {
  const allSongs = await db.select().from(songs);
  return (
    buildOwnerIndex(allSongs).get(songKey(song)) ?? new Set([song.playerId])
  );
}

/**
 * Ends the listening phase as soon as every expected player has answered.
 * Race-safe: the conditional UPDATE only succeeds once per round.
 */
export async function endRoundIfEveryoneAnswered(
  st: GameStateRow,
): Promise<GameStateRow> {
  if (st.status !== "playing") return st;
  const songId = st.roundOrder?.[st.roundIndex];
  if (!songId) return st;

  const [song] = await db.select().from(songs).where(eq(songs.id, songId));
  if (!song) return st;

  const owners = await ownersOfSong(song);
  const playerRows = await db.select().from(players);
  const nowMs = Date.now();
  const expected = eligibleAnswerers(playerRows, owners, nowMs).length;
  if (expected === 0) return st;

  const answered = await db
    .select({ id: liveAnswers.id })
    .from(liveAnswers)
    .where(eq(liveAnswers.songId, songId));
  if (answered.length < expected) return st;

  return forceReveal(st.roundIndex);
}

/** Moves the current round straight to the reveal phase. */
export async function forceReveal(roundIndex: number): Promise<GameStateRow> {
  const now = new Date();
  const res = await db
    .update(gameState)
    .set({
      status: "reveal",
      phaseEndsAt: new Date(now.getTime() + REVEAL_S * 1000),
      updatedAt: now,
    })
    .where(
      and(
        eq(gameState.id, GAME_STATE_ID),
        eq(gameState.status, "playing"),
        eq(gameState.roundIndex, roundIndex),
      ),
    )
    .returning();
  if (res[0]) return res[0];
  return getOrCreateState();
}

export type LiveStatus =
  | "lobby"
  | "countdown"
  | "playing"
  | "reveal"
  | "finished";
