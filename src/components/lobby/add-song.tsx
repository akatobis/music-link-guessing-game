"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2, Search, X } from "lucide-react";
import { parseMusicLink, type MusicProvider } from "@/lib/providers";
import { ProviderChip } from "@/components/provider-chip";

interface Draft {
  pageUrl: string;
  provider: MusicProvider;
  title: string;
  artist: string;
  thumbnail: string | null;
}

export function AddSongForm({
  playerId,
  accent,
}: {
  playerId: string;
  accent: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, startSaving] = useTransition();

  const detected = useMemo(
    () => (url.trim().length > 6 ? parseMusicLink(url) : null),
    [url],
  );

  async function resolve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          j.error === "unsupported"
            ? "Не понимаю ссылку — нужен трек с YouTube, Spotify или Яндекс Музыки"
            : "Что-то пошло не так, попробуй ещё раз",
        );
        return;
      }
      const j = (await res.json()) as {
        pageUrl: string;
        provider: MusicProvider;
        title?: string;
        artist?: string;
        thumbnail?: string | null;
      };
      setDraft({
        pageUrl: j.pageUrl,
        provider: j.provider,
        title: j.title ?? "",
        artist: j.artist ?? "",
        thumbnail: j.thumbnail ?? null,
      });
    } catch {
      setError("Нет связи. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!draft) return;
    startSaving(async () => {
      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          url: draft.pageUrl,
          title: draft.title,
          artist: draft.artist,
          thumbnail: draft.thumbnail,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          j.error === "songs_limit"
            ? "У этого игрока уже 10 треков"
            : j.error === "duplicate_own"
              ? "Этот трек уже есть в твоём списке"
              : "Не удалось сохранить трек",
        );
        return;
      }
      setUrl("");
      setDraft(null);
      router.refresh();
    });
  }

  if (draft) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-start gap-3">
          {draft.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={draft.thumbnail}
              alt=""
              className="size-14 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-white/5">
              <Link2 className="size-5 text-white/40" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <ProviderChip provider={draft.provider} compact />
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="rounded-full p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Отмена"
              >
                <X className="size-4" />
              </button>
            </div>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Название трека"
              className="field !rounded-lg !px-2.5 !py-1.5 !text-sm"
            />
            <input
              value={draft.artist}
              onChange={(e) => setDraft({ ...draft, artist: e.target.value })}
              placeholder="Исполнитель"
              className="field !rounded-lg !px-2.5 !py-1.5 !text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !draft.title.trim()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
          style={{ background: accent }}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Сохранить трек
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && detected && !busy) resolve();
            }}
            placeholder="Вставь ссылку на трек…"
            className="field !pl-9"
            inputMode="url"
          />
        </div>
        <button
          type="button"
          onClick={resolve}
          disabled={!detected || busy}
          className="grid size-11 shrink-0 place-items-center rounded-2xl text-white transition-transform enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-30"
          style={{ background: accent }}
          aria-label="Найти трек"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Search className="size-5" />
          )}
        </button>
      </div>
      <div className="mt-2 flex min-h-6 items-center gap-2 px-1">
        {detected && !error && (
          <>
            <span className="text-xs text-white/40">Нашёл:</span>
            <ProviderChip provider={detected.provider} compact />
          </>
        )}
        {url.trim().length > 10 && !detected && !error && !busy && (
          <span className="text-xs text-white/35">
            Ссылка не похожа на YouTube / Spotify / Яндекс Музыку
          </span>
        )}
        {error && <span className="text-xs text-neon">{error}</span>}
      </div>
    </div>
  );
}
