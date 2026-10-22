// Shared link parsing for YouTube / Spotify / Yandex Music.
// Used both on the client (instant detection) and on the server (validation).

export type MusicProvider = "youtube" | "spotify" | "yandex";

export interface ParsedLink {
  provider: MusicProvider;
  providerId: string;
  albumId: string | null;
  pageUrl: string;
  embedUrl: string;
}

const YT_RE =
  /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?[^#\s]*v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([\w-]{11})(?:[?&#][^\s]*)?/i;

const SPOTIFY_URL_RE =
  /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?track\/([A-Za-z0-9]+)/i;

const SPOTIFY_URI_RE = /^spotify:track:([A-Za-z0-9]+)$/i;

const YANDEX_RE =
  /(?:https?:\/\/)?music\.yandex\.[a-z]{2,3}(?:\.[a-z]{2})?\/(?:album\/(\d+)\/)?track\/(\d+)/i;

export function parseMusicLink(input: string): ParsedLink | null {
  const url = input.trim();
  if (!url) return null;

  const yt = url.match(YT_RE);
  if (yt) {
    const id = yt[1];
    return {
      provider: "youtube",
      providerId: id,
      albumId: null,
      pageUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube.com/embed/${id}`,
    };
  }

  const spUrl = url.match(SPOTIFY_URL_RE);
  const spUri = url.match(SPOTIFY_URI_RE);
  const spotifyId = spUrl?.[1] ?? spUri?.[1];
  if (spotifyId) {
    return {
      provider: "spotify",
      providerId: spotifyId,
      albumId: null,
      pageUrl: `https://open.spotify.com/track/${spotifyId}`,
      embedUrl: `https://open.spotify.com/embed/track/${spotifyId}`,
    };
  }

  const ym = url.match(YANDEX_RE);
  if (ym) {
    const albumId = ym[1] ?? null;
    const trackId = ym[2];
    return {
      provider: "yandex",
      providerId: trackId,
      albumId,
      pageUrl: albumId
        ? `https://music.yandex.ru/album/${albumId}/track/${trackId}`
        : `https://music.yandex.ru/track/${trackId}`,
      embedUrl: albumId
        ? `https://music.yandex.ru/iframe/#track/${trackId}/${albumId}`
        : `https://music.yandex.ru/iframe/#track/${trackId}`,
    };
  }

  return null;
}

export function youtubeThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export const PROVIDER_META: Record<
  MusicProvider,
  { label: string; short: string; color: string; textOn: string }
> = {
  youtube: {
    label: "YouTube",
    short: "YT",
    color: "#FF3B4E",
    textOn: "#ffffff",
  },
  spotify: {
    label: "Spotify",
    short: "SP",
    color: "#1ED760",
    textOn: "#04140a",
  },
  yandex: {
    label: "Яндекс Музыка",
    short: "ЯМ",
    color: "#FFCC00",
    textOn: "#1a1300",
  },
};

export const SNIPPET_SECONDS = 25;
export const MAX_SONGS_PER_PLAYER = 10;
export const MAX_PLAYERS = 12;
