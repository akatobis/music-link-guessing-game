"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ExternalLink,
  EyeOff,
  Hand,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Music2,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wifi,
} from "lucide-react";
import type { SongDTO } from "@/lib/types";
import { PLAYER_COLORS } from "@/lib/colors";
import { MAX_SONGS_PER_PLAYER } from "@/lib/providers";
import { ProviderIcon } from "@/components/provider-chip";
import { AddSongForm } from "@/components/lobby/add-song";

const LS_KEY = "qt-player-id";

function loadMe() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LS_KEY) ?? "";
}

export interface LobbyPlayer {
  id: string;
  name: string;
  color: string;
  online: boolean;
  songCount: number;
  songs: SongDTO[];
}

interface LobbyData {
  serverNow: number;
  status: string;
  players: LobbyPlayer[];
}

export interface LobbyInitialPlayer {
  id: string;
  name: string;
  color: string;
  songCount: number;
}

export default function LobbyClient({
  initial,
}: {
  initial: LobbyInitialPlayer[];
}) {
  const router = useRouter();
  const [meId, setMeId] = useState("");
  const [meChecked, setMeChecked] = useState(false);
  const [data, setData] = useState<LobbyData>({
    serverNow: Date.now(),
    status: "lobby",
    players: initial.map((p) => ({ ...p, online: false, songs: [] })),
  });
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pickedColor, setPickedColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [seeding, startSeed] = useTransition();
  const [starting, startGame] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // claim flow
  const [claimTargetId, setClaimTargetId] = useState<string | null>(null);
  const [claimPin, setClaimPin] = useState("");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);

  useEffect(() => {
    setMeId(loadMe());
    setMeChecked(true);
  }, []);

  const load = useCallback(async () => {
    try {
      const id = loadMe();
      const res = await fetch(
        `/api/live/lobby?playerId=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const j = (await res.json()) as LobbyData;
      setData(j);
    } catch {
      /* keep previous state */
    }
  }, []);

  useEffect(() => {
    if (!meChecked) return;
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [meChecked, load]);

  function claim(id: string) {
    localStorage.setItem(LS_KEY, id);
    setMeId(id);
    load();
  }

  function unclaim() {
    localStorage.removeItem(LS_KEY);
    setMeId("");
    setConfirmDelete(false);
  }

  async function submitClaim() {
    if (!claimTargetId || claimPin.length !== 4) return;
    setClaimBusy(true);
    setClaimError(null);
    try {
      const res = await fetch("/api/players/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: claimTargetId, pin: claimPin }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setClaimError(
          j.error === "too_many"
            ? "Слишком много попыток. Подожди 30 секунд."
            : "Неверный PIN-код",
        );
        return;
      }
      claim(claimTargetId);
      setClaimTargetId(null);
      setClaimPin("");
    } catch {
      setClaimError("Нет связи. Попробуй ещё раз.");
    } finally {
      setClaimBusy(false);
    }
  }

  const players = data.players;
  const me = players.find((p) => p.id === meId) ?? null;
  const unusedColor =
    PLAYER_COLORS.find((c) => !players.some((p) => p.color === c)) ??
    PLAYER_COLORS[players.length % PLAYER_COLORS.length];
  const activeColor = pickedColor ?? unusedColor;

  const totalSongs = players.reduce((n, p) => n + p.songCount, 0);
  const readyPlayers = players.filter((p) => p.songCount > 0).length;
  const canStart = players.length >= 2 && readyPlayers === players.length;
  const gameRunning = ["countdown", "playing", "reveal"].includes(data.status);
  const gameFinished = data.status === "finished";
  const onlineCount = players.filter((p) => p.online).length;

  function addPlayer() {
    if (!name.trim() || pin.length !== 4) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color: activeColor, pin }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          j.error === "duplicate_name"
            ? "Игрок с таким именем уже есть"
            : j.error === "players_limit"
              ? "Максимум 12 игроков"
              : "Не получилось добавить игрока",
        );
        return;
      }
      const created = (await res.json()) as { id: string };
      setName("");
      setPin("");
      setPickedColor(null);
      claim(created.id);
    });
  }

  function removeSong(id: string) {
    startTransition(async () => {
      await fetch(`/api/songs/${id}`, { method: "DELETE" });
      load();
    });
  }

  function deleteSelf() {
    if (!me) return;
    startTransition(async () => {
      await fetch(`/api/players/${me.id}`, { method: "DELETE" });
      unclaim();
    });
  }

  function seedDemo() {
    startSeed(async () => {
      await fetch("/api/seed", { method: "POST" });
      load();
    });
  }

  function start() {
    startGame(async () => {
      const res = await fetch("/api/live/start", { method: "POST" });
      if (res.ok || res.status === 409) {
        router.push("/play");
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          j.error === "need_songs"
            ? "У каждого игрока должен быть хотя бы один трек"
            : j.error === "no_rounds"
              ? "Все треки совпали у всех игроков — добавьте что-то своё"
              : "Нужно минимум два игрока",
        );
      }
    });
  }

  function resetGame() {
    startGame(async () => {
      await fetch("/api/live/reset", { method: "POST" });
      setConfirmReset(false);
    });
  }

  const claimTarget = players.find((p) => p.id === claimTargetId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-14 pb-44 sm:px-6">
      {/* header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.25em] text-white/40 uppercase">
            <Users className="size-3.5" /> Онлайн-лобби
          </p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
            <span className="text-grad">Лобби</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/55 sm:text-base">
            Каждый заходит со своего устройства под своим PIN-кодом и добавляет
            до {MAX_SONGS_PER_PLAYER} треков. Чужие треки скрыты — никто не
            подсмотрит твой плейлист.
          </p>
        </div>
        {players.length > 0 && (
          <div className="glass flex items-center gap-5 rounded-2xl px-5 py-3.5 text-sm">
            <div>
              <div className="font-display text-2xl font-bold">
                {players.length}
              </div>
              <div className="text-xs text-white/45">игроков</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <div className="font-display text-2xl font-bold">
                {totalSongs}
              </div>
              <div className="text-xs text-white/45">треков</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <div className="font-display flex items-center gap-1.5 text-2xl font-bold text-lime">
                <Wifi className="size-4" />
                {onlineCount}
              </div>
              <div className="text-xs text-white/45">онлайн</div>
            </div>
          </div>
        )}
      </div>

      {/* identity picker */}
      {meChecked && !me && players.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mb-6 rounded-3xl p-6"
        >
          <h2 className="font-display flex items-center gap-2 text-base font-bold">
            <Hand className="size-4 text-aqua" /> Кто из них ты?
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Выбери себя и введи свой PIN-код. Или создай нового игрока ниже.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setClaimTargetId(p.id === claimTargetId ? null : p.id);
                  setClaimPin("");
                  setClaimError(null);
                }}
                className={`group flex items-center gap-2.5 rounded-full border py-2 pr-4 pl-2 text-sm font-semibold transition-all hover:scale-[1.03] active:scale-95 ${
                  p.id === claimTargetId
                    ? "border-white/40 bg-white/10"
                    : "border-white/10 bg-white/5 hover:border-white/30"
                }`}
              >
                <span
                  className="font-display grid size-7 place-items-center rounded-full text-xs font-bold"
                  style={{ background: p.color }}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                {p.name}
                {p.online && (
                  <span className="size-2 rounded-full bg-lime" title="онлайн" />
                )}
              </button>
            ))}
          </div>

          {claimTarget && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/8 pt-4">
                <span
                  className="flex items-center gap-2 text-sm font-semibold"
                  style={{ color: claimTarget.color }}
                >
                  <KeyRound className="size-4" /> PIN для {claimTarget.name}
                </span>
                <input
                  value={claimPin}
                  onChange={(e) => {
                    setClaimPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                    setClaimError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && submitClaim()}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="••••"
                  maxLength={4}
                  autoFocus
                  className="field !w-28 text-center font-display !text-lg tracking-[0.5em]"
                  style={{ caretColor: claimTarget.color }}
                />
                <button
                  type="button"
                  onClick={submitClaim}
                  disabled={claimBusy || claimPin.length !== 4}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-viol px-5 py-2.5 text-sm font-bold transition-transform enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-40"
                >
                  {claimBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  Войти
                </button>
                {claimError && (
                  <span className="text-xs font-medium text-neon">
                    {claimError}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </motion.section>
      )}

      {/* me banner */}
      {me && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5"
          style={{ boxShadow: `0 0 60px -30px ${me.color}` }}
        >
          <div className="flex items-center gap-3">
            <span
              className="font-display grid size-11 place-items-center rounded-2xl text-lg font-bold"
              style={{ background: me.color }}
            >
              {me.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <div className="font-display text-base font-bold">
                Ты — {me.name}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-lime">
                <span className="size-1.5 animate-glow-pulse rounded-full bg-lime" />
                онлайн · твои треки видишь только ты
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={unclaim}
              className="flex items-center gap-1.5 rounded-full bg-white/5 px-3.5 py-2 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-3.5" /> Это не я
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={deleteSelf}
                  className="rounded-full bg-neon/20 px-3.5 py-2 text-xs font-semibold text-neon hover:bg-neon/30"
                >
                  Удалить меня и мои треки
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-full bg-white/5 px-3.5 py-2 text-xs text-white/60 hover:bg-white/10"
                >
                  Оставить
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded-full bg-white/5 px-3.5 py-2 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-neon"
              >
                <Trash2 className="size-3.5" /> Удалить профиль
              </button>
            )}
          </div>
        </motion.section>
      )}

      {/* empty state */}
      {players.length === 0 && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mb-6 rounded-3xl p-8 text-center sm:p-12"
        >
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-neon to-viol shadow-[0_0_40px_rgba(255,46,136,0.4)]">
            <Music2 className="size-8 text-white" />
          </div>
          <h2 className="font-display text-xl font-bold sm:text-2xl">
            Пока пусто и тихо
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/55">
            Создай первого игрока ниже — или нажми «Демо», и лобби наполнится
            тремя друзьями и девятью треками. Идеально, чтобы потестить игру в
            два браузера.
          </p>
          <button
            type="button"
            onClick={seedDemo}
            disabled={seeding}
            className="mx-auto mt-6 flex items-center gap-2 rounded-full border border-aqua/40 bg-aqua/10 px-5 py-2.5 text-sm font-semibold text-aqua transition-all hover:scale-[1.03] hover:bg-aqua/20 active:scale-95"
          >
            {seeding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Заполнить демо
          </button>
        </motion.section>
      )}

      <div className="grid items-start gap-5 md:grid-cols-2">
        {/* add player */}
        <motion.section
          layout
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-6"
        >
          <h2 className="font-display flex items-center gap-2 text-base font-bold">
            <Plus className="size-4 text-neon" /> Новый игрок
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Впиши имя и придумай PIN из 4 цифр — он защитит твой профиль и
            треки от чужих глаз.
          </p>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              placeholder="Имя игрока"
              maxLength={24}
              className="field"
            />
            <input
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              inputMode="numeric"
              autoComplete="off"
              placeholder="PIN"
              maxLength={4}
              className="field !w-24 text-center font-display tracking-[0.4em]"
              aria-label="PIN-код из 4 цифр"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setPickedColor(c)}
                aria-label={`Цвет ${c}`}
                className={`size-8 rounded-full transition-transform hover:scale-110 active:scale-95 ${
                  c === activeColor
                    ? "ring-2 ring-white ring-offset-2 ring-offset-ink"
                    : "opacity-70 hover:opacity-100"
                }`}
                style={{ background: c }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addPlayer}
            disabled={pending || !name.trim() || pin.length !== 4}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-neon to-viol py-3 text-sm font-semibold shadow-[0_8px_30px_-8px_rgba(255,46,136,0.6)] transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 disabled:opacity-40"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Войти в игру
          </button>
          {error && <p className="mt-2 text-xs text-neon">{error}</p>}
        </motion.section>

        {/* players */}
        {players.map((p, i) => {
          const isMe = me?.id === p.id;
          const progress = p.songCount / MAX_SONGS_PER_PLAYER;
          return (
            <motion.section
              key={p.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}
              className={`glass relative overflow-hidden rounded-3xl p-6 ${
                isMe ? "ring-1 ring-white/20" : ""
              }`}
              style={{ boxShadow: `0 0 80px -48px ${p.color}` }}
            >
              <div
                className="pointer-events-none absolute -top-20 -right-20 size-48 rounded-full opacity-25 blur-3xl"
                style={{ background: p.color }}
              />

              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="font-display grid size-11 place-items-center rounded-2xl text-lg font-bold"
                    style={{ background: p.color }}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <h3 className="font-display flex items-center gap-2 text-lg font-bold">
                      {p.name}
                      {isMe && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white/60 uppercase">
                          это ты
                        </span>
                      )}
                    </h3>
                    <p className="flex items-center gap-1.5 text-xs text-white/45">
                      {p.songCount} / {MAX_SONGS_PER_PLAYER} треков
                      <span
                        className={`ml-1 size-1.5 rounded-full ${
                          p.online ? "bg-lime" : "bg-white/20"
                        }`}
                      />
                      {p.online ? "онлайн" : "офлайн"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: p.color }}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.max(progress * 100, p.songCount ? 6 : 0)}%`,
                  }}
                  transition={{ type: "spring", stiffness: 80, damping: 20 }}
                />
              </div>

              {isMe ? (
                <div className="mt-4 space-y-2">
                  {p.songs.map((s) => (
                    <div
                      key={s.id}
                      className="group flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-2 pr-1.5 transition-colors hover:bg-white/[0.06]"
                    >
                      {s.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.thumbnail}
                          alt=""
                          className="size-10 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-white/40">
                          <ProviderIcon provider={s.provider} className="size-4" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {s.title}
                        </div>
                        <div className="truncate text-xs text-white/40">
                          {s.artist || "—"}
                        </div>
                      </div>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full p-2 text-white/25 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Открыть оригинал"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => removeSong(s.id)}
                        className="rounded-full p-2 text-white/25 transition-colors hover:bg-white/10 hover:text-neon"
                        aria-label={`Удалить трек ${s.title}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}

                  {p.songCount < MAX_SONGS_PER_PLAYER ? (
                    <div className="pt-1">
                      <AddSongForm playerId={p.id} accent={p.color} />
                    </div>
                  ) : (
                    <p className="pt-2 text-center text-xs text-white/40">
                      Лимит: {MAX_SONGS_PER_PLAYER} треков — отличный вкус!
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-4 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-white/35">
                    {p.songCount > 0 ? (
                      <Lock className="size-5" />
                    ) : (
                      <EyeOff className="size-5" />
                    )}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-white/70">
                      {p.songCount > 0
                        ? `Треки у ${p.name} под замком`
                        : `${p.name} ещё не добавил треки`}
                    </div>
                    <div className="mt-0.5 text-xs text-white/40">
                      {p.songCount > 0
                        ? "Всё тайное станет явным только во время игры"
                        : "Лёгкий стук — напомни, что ждём музыку"}
                    </div>
                  </div>
                </div>
              )}
            </motion.section>
          );
        })}
      </div>

      {/* sticky action bar */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed inset-x-4 bottom-4 z-30 sm:inset-x-6"
      >
        <div className="glass mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]">
          {gameRunning ? (
            <>
              <div className="text-sm text-white/60">
                <span className="font-semibold text-lime">Игра идёт прямо сейчас!</span>{" "}
                Подключайся.
              </div>
              <div className="flex items-center gap-2">
                {confirmReset ? (
                  <>
                    <button
                      type="button"
                      onClick={resetGame}
                      className="rounded-full bg-neon/20 px-4 py-2.5 text-xs font-semibold text-neon hover:bg-neon/30"
                    >
                      Точно прервать игру?
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="rounded-full bg-white/5 px-4 py-2.5 text-xs text-white/60 hover:bg-white/10"
                    >
                      Нет
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="rounded-full bg-white/5 px-4 py-2.5 text-xs text-white/50 hover:bg-white/10"
                  >
                    Сбросить
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push("/play")}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-lime to-aqua px-6 py-3 text-sm font-bold text-ink transition-transform hover:scale-105 active:scale-95"
                >
                  <Play className="size-4" /> Подключиться
                </button>
              </div>
            </>
          ) : gameFinished ? (
            <>
              <div className="text-sm text-white/60">
                Прошлая игра завершена. Можно глянуть итоги — или сразу
                накидать новых треков.
              </div>
              <button
                type="button"
                onClick={() => router.push("/play")}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-viol px-6 py-3 text-sm font-bold transition-transform hover:scale-105 active:scale-95"
              >
                <Play className="size-4" /> К итогам
              </button>
            </>
          ) : (
            <>
              <div className="text-sm text-white/60">
                {canStart ? (
                  <>
                    <span className="font-semibold text-white">
                      Всё готово!
                    </span>{" "}
                    {totalSongs} треков в миксе, {onlineCount} онлайн. Жми
                    «Начать» — игра включится у всех одновременно.
                  </>
                ) : me ? (
                  <>
                    Готовы {readyPlayers} из {players.length}. Нужно минимум 2
                    игрока, и у каждого — хотя бы 1 трек.
                  </>
                ) : (
                  <>Сначала выбери себя (или создай игрока), чтобы играть.</>
                )}
              </div>
              <button
                type="button"
                onClick={start}
                disabled={!canStart || !me || starting}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-viol px-6 py-3 text-sm font-bold shadow-[0_0_30px_rgba(255,46,136,0.5)] transition-transform enabled:hover:scale-105 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {starting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                Начать викторину
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
