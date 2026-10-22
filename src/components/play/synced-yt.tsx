"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Loader2, RefreshCw, Volume2 } from "lucide-react";
import { Vinyl } from "@/components/vinyl";
import { Equalizer } from "@/components/equalizer";

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytPromise: Promise<void> | null = null;

export function loadYouTubeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (!ytPromise) {
    ytPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.async = true;
      document.head.appendChild(tag);
    });
  }
  return ytPromise;
}

type SyncState = "loading" | "queued" | "playing" | "error";

/**
 * Hidden YouTube player that starts a deterministic snippet exactly at
 * `startAtMs` (server epoch) and keeps correcting drift against it.
 */
export function SyncedYouTube({
  videoId,
  fraction,
  startAtMs,
  offsetRef,
  accent,
}: {
  videoId: string;
  fraction: number;
  startAtMs: number;
  offsetRef: MutableRefObject<number>;
  accent: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const snipRef = useRef<number | null>(null); // snippet start (sec, in-video)
  const durationRef = useRef<number>(0);
  const kickTimerRef = useRef<number | null>(null);
  const driftRef = useRef<number | null>(null);
  const [state, setState] = useState<SyncState>("loading");
  const [audioIssue, setAudioIssue] = useState(false);

  const serverNow = useCallback(
    () => Date.now() + offsetRef.current,
    [offsetRef],
  );

  const clearTimers = useCallback(() => {
    if (kickTimerRef.current !== null) {
      window.clearTimeout(kickTimerRef.current);
      kickTimerRef.current = null;
    }
    if (driftRef.current !== null) {
      window.clearInterval(driftRef.current);
      driftRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setAudioIssue(false);

    loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current) return;

      const configure = (player: any) => {
        try {
          const dur = player.getDuration?.() ?? 0;
          if (dur > 0) {
            durationRef.current = dur;
            const maxStart = Math.max(0, dur - 30);
            snipRef.current = Math.min(fraction * dur, maxStart);
            return true;
          }
        } catch {
          /* noop */
        }
        return false;
      };

      const kick = () => {
        if (cancelled) return;
        const p = playerRef.current;
        if (!p?.playVideo) return;
        const elapsedSec = Math.max(0, (serverNow() - startAtMs) / 1000);
        const start = (snipRef.current ?? 0) + elapsedSec;
        try {
          p.seekTo(start, true);
        } catch {
          /* noop */
        }
        p.playVideo();
        setState("playing");
        // drift guard
        driftRef.current = window.setInterval(() => {
          const pl = playerRef.current;
          if (!pl?.getCurrentTime || snipRef.current === null) return;
          const expected =
            snipRef.current + Math.max(0, (serverNow() - startAtMs) / 1000);
          if (
            durationRef.current > 0 &&
            expected > durationRef.current - 0.5
          ) {
            return;
          }
          try {
            const ct = pl.getCurrentTime();
            if (Math.abs(ct - expected) > 2.5) {
              pl.seekTo(expected, true);
            }
          } catch {
            /* noop */
          }
        }, 2000);
      };

      const schedule = () => {
        const delay = startAtMs - serverNow();
        if (delay > 250) {
          setState("queued");
          kickTimerRef.current = window.setTimeout(kick, delay);
        } else {
          kick();
        }
      };

      let scheduled = false;
      const scheduleOnce = () => {
        if (scheduled) return;
        scheduled = true;
        schedule();
      };

      const player = new window.YT.Player(hostRef.current, {
        width: 2,
        height: 2,
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            if (configure(player)) scheduleOnce();
          },
          onStateChange: (e: any) => {
            if (cancelled) return;
            const YT = window.YT;
            if (e.data === YT.PlayerState.CUED) {
              if (configure(player)) scheduleOnce();
            } else if (e.data === YT.PlayerState.PLAYING) {
              setState("playing");
            } else if (e.data === YT.PlayerState.ENDED) {
              setState("queued");
            } else if (e.data === YT.PlayerState.PAUSED) {
              setAudioIssue(true);
            }
          },
          onError: () => {
            if (!cancelled) {
              setState("error");
              setAudioIssue(true);
            }
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      clearTimers();
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      playerRef.current = null;
    };
  }, [videoId, fraction, startAtMs, serverNow, clearTimers]);

  const resync = useCallback(() => {
    const p = playerRef.current;
    if (!p?.playVideo) return;
    const elapsedSec = Math.max(0, (serverNow() - startAtMs) / 1000);
    try {
      p.seekTo((snipRef.current ?? 0) + elapsedSec, true);
    } catch {
      /* noop */
    }
    p.playVideo();
    setAudioIssue(false);
    setState("playing");
  }, [serverNow, startAtMs]);

  const spinning = state === "playing" && !audioIssue;

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      {/* hidden iframe */}
      <div className="pointer-events-none fixed right-0 bottom-0 h-[3px] w-[3px] overflow-hidden opacity-[0.01]">
        <div ref={hostRef} />
      </div>

      <Vinyl spinning={spinning} label={accent} size={210} />

      <div className="flex items-center gap-3">
        <Equalizer active={spinning} color={accent} />
        <span className="text-sm text-white/50">
          {state === "loading" && "Подключаюсь к YouTube…"}
          {state === "queued" && !audioIssue && "Трек вот-вот начнётся…"}
          {state === "playing" && !audioIssue && "Играет во всех браузерах"}
          {audioIssue && "Звук не пошёл? Нажми «Перезапустить»"}
        </span>
      </div>

      {(audioIssue || state === "error") && (
        <button
          type="button"
          onClick={resync}
          className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-ink transition-transform hover:scale-105 active:scale-95"
        >
          <RefreshCw className="size-4" /> Перезапустить звук
          <Volume2 className="size-4" />
        </button>
      )}

      {state === "loading" && (
        <Loader2 className="size-5 animate-spin text-white/30" />
      )}
    </div>
  );
}
