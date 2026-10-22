import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { players, songs } from "@/db/schema";
import {
  MAX_SONGS_PER_PLAYER,
  parseMusicLink,
  youtubeThumb,
} from "@/lib/providers";
import { resolveMetadata } from "@/lib/metadata";
import { toSongDTO } from "@/lib/data";
import { asc } from "drizzle-orm";

export async function GET(req: Request) {
  const playerId = new URL(req.url).searchParams.get("playerId") ?? "";
  if (!playerId) {
    return NextResponse.json({ error: "player_required" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(songs)
    .where(eq(songs.playerId, playerId))
    .orderBy(asc(songs.createdAt));
  return NextResponse.json(rows.map(toSongDTO));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        playerId?: unknown;
        url?: unknown;
        title?: unknown;
        artist?: unknown;
        thumbnail?: unknown;
      }
    | null;

  const playerId = typeof body?.playerId === "string" ? body.playerId : "";
  const url = typeof body?.url === "string" ? body.url : "";
  const customTitle = typeof body?.title === "string" ? body.title.trim() : "";
  const customArtist =
    typeof body?.artist === "string" ? body.artist.trim() : "";
  const customThumb =
    typeof body?.thumbnail === "string" ? body.thumbnail.trim() : "";

  if (!playerId || !url.trim()) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const [owner] = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.id, playerId));
  if (!owner) {
    return NextResponse.json({ error: "player_not_found" }, { status: 404 });
  }

  const parsed = parseMusicLink(url);
  if (!parsed) {
    return NextResponse.json({ error: "unsupported" }, { status: 422 });
  }

  const mySongs = await db
    .select()
    .from(songs)
    .where(eq(songs.playerId, playerId));

  if (mySongs.length >= MAX_SONGS_PER_PLAYER) {
    return NextResponse.json({ error: "songs_limit" }, { status: 422 });
  }

  // Same track twice in one playlist makes no sense. Duplicates across
  // different players are allowed on purpose (they become a shared round).
  const alreadyMine = mySongs.some(
    (s) =>
      s.provider === parsed.provider && s.providerId === parsed.providerId,
  );
  if (alreadyMine) {
    return NextResponse.json({ error: "duplicate_own" }, { status: 409 });
  }

  const meta = await resolveMetadata(parsed);

  let thumbnail = customThumb || meta.thumbnail || null;
  if (!thumbnail && parsed.provider === "youtube") {
    thumbnail = youtubeThumb(parsed.providerId);
  }

  const [created] = await db
    .insert(songs)
    .values({
      playerId,
      provider: parsed.provider,
      providerId: parsed.providerId,
      albumId: parsed.albumId,
      url: parsed.pageUrl,
      embedUrl: parsed.embedUrl,
      title: customTitle || meta.title || "Без названия",
      artist: customArtist || meta.artist || "",
      thumbnail,
    })
    .returning();

  return NextResponse.json(toSongDTO(created), { status: 201 });
}
