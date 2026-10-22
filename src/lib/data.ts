import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { players, songs, games, gameRounds } from "@/db/schema";
import type { GameWithRounds, PlayerWithSongs, SongDTO } from "./types";
import type { MusicProvider } from "./providers";

export function toSongDTO(row: typeof songs.$inferSelect): SongDTO {
  return {
    id: row.id,
    playerId: row.playerId,
    provider: row.provider as MusicProvider,
    providerId: row.providerId,
    albumId: row.albumId,
    url: row.url,
    embedUrl: row.embedUrl,
    title: row.title,
    artist: row.artist,
    thumbnail: row.thumbnail,
  };
}

export async function getPlayersWithSongs(): Promise<PlayerWithSongs[]> {
  const playerRows = await db
    .select()
    .from(players)
    .orderBy(asc(players.createdAt));
  const songRows = await db.select().from(songs).orderBy(asc(songs.createdAt));

  return playerRows.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    songs: songRows.filter((s) => s.playerId === p.id).map(toSongDTO),
  }));
}

export interface LobbyPlayerLite {
  id: string;
  name: string;
  color: string;
  songCount: number;
}

/** Public lobby snapshot — never includes song details (anti-spoiler). */
export async function getLobbyPlayersLite(): Promise<LobbyPlayerLite[]> {
  const playerRows = await db
    .select()
    .from(players)
    .orderBy(asc(players.createdAt));
  const songRows = await db.select({ playerId: songs.playerId }).from(songs);
  const counts = new Map<string, number>();
  for (const s of songRows) {
    counts.set(s.playerId, (counts.get(s.playerId) ?? 0) + 1);
  }
  return playerRows.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    songCount: counts.get(p.id) ?? 0,
  }));
}

export async function getGamesHistory(limit = 30): Promise<GameWithRounds[]> {
  const gameRows = await db
    .select()
    .from(games)
    .orderBy(desc(games.createdAt))
    .limit(limit);

  if (gameRows.length === 0) return [];

  const roundRows = await db
    .select()
    .from(gameRounds)
    .orderBy(asc(gameRounds.position));

  return gameRows.map((game) => ({
    game,
    rounds: roundRows.filter((r) => r.gameId === game.id),
  }));
}
