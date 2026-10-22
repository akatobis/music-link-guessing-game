import type { ParsedLink } from "./providers";
import { youtubeThumb } from "./providers";

export interface ResolvedMeta {
  title: string;
  artist: string;
  thumbnail: string | null;
}

const EMPTY: ResolvedMeta = { title: "", artist: "", thumbnail: null };

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function timeoutSignal(ms: number) {
  return AbortSignal.timeout(ms);
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .trim();
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: timeoutSignal(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

function splitTitleArtist(raw: string): { title: string; artist: string } {
  const seps = [" — ", " – ", " - ", " · "];
  for (const sep of seps) {
    const i = raw.indexOf(sep);
    if (i > 0) {
      const left = raw.slice(0, i).trim();
      const right = raw.slice(i + sep.length).trim();
      if (left && right) return { artist: left, title: right };
    }
  }
  return { title: raw.trim(), artist: "" };
}

async function resolveYouTube(parsed: ParsedLink): Promise<ResolvedMeta> {
  const fallbackThumb = youtubeThumb(parsed.providerId);
  try {
    const j = await fetchJson(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.pageUrl)}&format=json`,
    );
    return {
      title: String(j.title ?? "").trim(),
      artist: String(j.author_name ?? "").trim(),
      thumbnail: j.thumbnail_url ? String(j.thumbnail_url) : fallbackThumb,
    };
  } catch {
    return { title: "", artist: "", thumbnail: fallbackThumb };
  }
}

async function resolveSpotify(parsed: ParsedLink): Promise<ResolvedMeta> {
  try {
    const j = await fetchJson(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.pageUrl)}`,
    );
    const raw = String(j.title ?? "").trim();
    const { title, artist } = splitTitleArtist(raw);
    return {
      title,
      artist,
      thumbnail: j.thumbnail_url ? String(j.thumbnail_url) : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

function pickMeta(html: string, key: string): string {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return "";
}

async function resolveYandex(parsed: ParsedLink): Promise<ResolvedMeta> {
  try {
    const res = await fetch(parsed.pageUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        "Accept-Language": "ru-RU,ru;q=0.9",
      },
      signal: timeoutSignal(9000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    let ogTitle =
      pickMeta(html, "og:title") || pickMeta(html, "twitter:title") || "";
    // Yandex often returns "Название — слушать онлайн" etc. Clean it up.
    ogTitle = ogTitle.replace(/\s*[—|].*слушать.*$/i, "").trim();
    const description = pickMeta(html, "og:description");
    const musicMusician = pickMeta(html, "music:musician");
    let image = pickMeta(html, "og:image") || pickMeta(html, "twitter:image");
    if (image.startsWith("//")) image = `https:${image}`;
    image = image.replace(/%%/g, "400x400");

    const { title, artist } = splitTitleArtist(ogTitle);
    return {
      title,
      artist: artist || musicMusician || description.slice(0, 80) || "",
      thumbnail: image || null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function resolveMetadata(parsed: ParsedLink): Promise<ResolvedMeta> {
  switch (parsed.provider) {
    case "youtube":
      return resolveYouTube(parsed);
    case "spotify":
      return resolveSpotify(parsed);
    case "yandex":
      return resolveYandex(parsed);
  }
}
