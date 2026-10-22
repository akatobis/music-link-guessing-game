import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { players, songs } from "@/db/schema";
import { parseMusicLink } from "@/lib/providers";
import { resolveMetadata } from "@/lib/metadata";

const DEMO: {
  name: string;
  color: string;
  songs: { url: string; title: string; artist: string }[];
}[] = [
  {
    name: "Даша",
    color: "#FF2E88",
    songs: [
      {
        url: "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
        title: "Bohemian Rhapsody",
        artist: "Queen",
      },
      {
        url: "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
        title: "Blinding Lights",
        artist: "The Weeknd",
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Never Gonna Give You Up",
        artist: "Rick Astley",
      },
    ],
  },
  {
    name: "Макс",
    color: "#22D3EE",
    songs: [
      {
        url: "https://www.youtube.com/watch?v=hTWKbfoikeg",
        title: "Smells Like Teen Spirit",
        artist: "Nirvana",
      },
      {
        url: "https://open.spotify.com/track/6K4t31amVTZDgR3sKmwUJJ",
        title: "The Less I Know The Better",
        artist: "Tame Impala",
      },
      {
        url: "https://www.youtube.com/watch?v=HyHNuVaZJ-k",
        title: "Feel Good Inc.",
        artist: "Gorillaz",
      },
    ],
  },
  {
    name: "Лёша",
    color: "#A3E635",
    songs: [
      {
        url: "https://www.youtube.com/watch?v=5NV6Rdv1a3I",
        title: "Get Lucky",
        artist: "Daft Punk",
      },
      {
        url: "https://open.spotify.com/track/2Fxmhks0bxGSBdJ92vM42m",
        title: "bad guy",
        artist: "Billie Eilish",
      },
      {
        url: "https://www.youtube.com/watch?v=Zi_XLOBDo_Y",
        title: "Billie Jean",
        artist: "Michael Jackson",
      },
    ],
  },
];

export async function POST() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(players);
  if (count > 0) {
    return NextResponse.json({ error: "not_empty" }, { status: 409 });
  }

  for (const demo of DEMO) {
    const [player] = await db
      .insert(players)
      .values({ name: demo.name, color: demo.color, pin: "1111" })
      .returning();

    const rows = await Promise.all(
      demo.songs.map(async (s) => {
        const parsed = parseMusicLink(s.url)!;
        const meta = await resolveMetadata(parsed);
        return {
          playerId: player.id,
          provider: parsed.provider,
          providerId: parsed.providerId,
          albumId: parsed.albumId,
          url: parsed.pageUrl,
          embedUrl: parsed.embedUrl,
          title: s.title || meta.title || "Без названия",
          artist: s.artist || meta.artist || "",
          thumbnail: meta.thumbnail,
        };
      }),
    );

    await db.insert(songs).values(rows);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
