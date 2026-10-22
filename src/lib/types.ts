import type { MusicProvider } from "./providers";
import type { GameRoundRow, GameRow } from "@/db/schema";

export interface SongDTO {
  id: string;
  playerId: string;
  provider: MusicProvider;
  providerId: string;
  albumId: string | null;
  url: string;
  embedUrl: string;
  title: string;
  artist: string;
  thumbnail: string | null;
}

export interface PlayerDTO {
  id: string;
  name: string;
  color: string;
}

export interface PlayerWithSongs extends PlayerDTO {
  songs: SongDTO[];
}

export interface GameWithRounds {
  game: GameRow;
  rounds: GameRoundRow[];
}
