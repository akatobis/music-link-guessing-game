"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Crown,
  Disc3,
  EyeOff,
  Headphones,
  History,
  Loader2,
  Music2,
  Play,
  RefreshCw,
  SkipForward,
  Timer,
  Users,
  Wifi,
  X,
} from "lucide-react";
import type { MusicProvider } from "@/lib/providers";
import { ProviderChip } from "@/components/provider-chip";
import { Equalizer } from "@/components/equalizer";
import { SyncedYouTube, loadYouTubeApi } from "./synced-yt";
import { celebrate, pop } from "@/lib/confetti";

const LS_KEY = "qt-player-id";

const loadMe = () =>
  typeof window === "undefined" ? "" : (localStorage.getItem(LS_KEY) ?? "");

interface ScoreRow {
  playerId: string;
  name: string;
  color: string;
  points: number;
}
interface PlayerLite {
  id: string;
  name: string;
  color: string;
}
interface GuessRow {
  guesserId: string;
  guesserName: string;
  guesserColor: string;
  guessedId: string | null;
  guessedName: string;
  correct: boolean;
  points: number;
  elapsedMs: number;
}
interface LiveState {
  serverNow: number;
  status: string;
  roundIndex: number;
  totalRounds: number;
  phaseEndsAt: number | null;
  countdownS: number;
  maxRoundS: number;
  revealS: number;
  scores: ScoreRow[];
  players: PlayerLite[];
  onlineCount: number;
  playersCount: number;
  meValid: boolean;
  song: {
    id: string;
    provider: string;
    providerId: string;
    albumId: string | null;
    embedUrl: string;
  } | null;
  songInfo: {
    title: string;
    artist: string;
    thumbnail: string | null;
    ownerId: string;
    ownerName: string;
    ownerColor: string;
    owners: { id: string; name: string; color: string }[];
  } | null;
  isOwner: boolean;
  myAnswer: {
    guessedPlayerId: string | null;
    correct: boolean;
    points: number;
    elapsedMs: number;
  } | null;
  answersCount: number;
  eligible: number;
  guesses: GuessRow[] | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function PlayClient() {
  const router = useRouter();
  const [meId, setMeId] = useState("");
  const [meChecked, setMeChecked] = useState(false);
  const [s, setS] = useState<LiveState | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [pendingGuess, setPendingGuess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trackEnded, setTrackEnded] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const offsetRef = useRef(0);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    setMeId(loadMe());
    setMeChecked(true);
  }, []);

  useEffect(() => {
    if (!meChecked) return;
    let stop = false;
    async function poll() {
      try {
        const id = loadMe();
        const r = await fetch(
          `/api/live/state?playerId=${encodeURIComponent(id)}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const j = (await r.json()) as LiveState;
        if (stop) return;
        offsetRef.current = j.serverNow - Date.now();
        setS(j);
      } catch {
        /* keep previous state */
      }
    }
    poll();
    const t = setInterval(poll, 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [meChecked]);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const now = tick + offsetRef.current;

  // clear pending guess once server confirms
  useEffect(() => {
    if (s?.myAnswer) setPendingGuess(null);
  }, [s?.myAnswer]);

  // confetti on finish
  useEffect(() => {
    if (s?.status === "finished") celebrate();
  }, [s?.status]);

  // new round → forget previous track-ended flag
  useEffect(() => {
    setTrackEnded(false);
  }, [s?.roundIndex, s?.status]);

  async function answer(guessedId: string) {
    if (!s || s.myAnswer || pendingGuess || !meId) return;
    setPendingGuess(guessedId);
    try {
      await fetch("/api/live/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: meId, guessedPlayerId: guessedId }),
      });
    } catch {
      setPendingGuess(null);
    }
  }

  async function showAnswer() {
    setSkipping(true);
    try {
      await fetch("/api/live/skip", { method: "POST" });
    } finally {
      setSkipping(false);
    }
  }

  async function playAgain() {
    setBusy(true);
    try {
      await fetch("/api/live/start", { method: "POST" });
    } finally {
      setBusy(false);
    }
  }

  async function toLobby() {
    setBusy(true);
    try {
      await fetch("/api/live/reset", { method: "POST" });
    } finally {
      router.push("/lobby");
    }
  }

  /* ------------------------------- identity gate ------------------------------ */
  if (!meChecked) return null;

  const staleProfile = meId && s && !s.meValid;
  if (!meId || staleProfile) {
    return (
      <GateShell icon={<Headphones className="size-9 text-white" />}>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
          {staleProfile ? "Твой профиль не найден" : "Сначала представься"}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-white/55">
          Загляни в лобби, выбери себя (или создай игрока) — и возвращайся
          сюда. Игра идёт для всех одновременно.
        </p>
        <Link
          href="/lobby"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-viol px-7 py-3.5 text-sm font-bold transition-transform hover:scale-105 active:scale-95"
        >
          В лобби <ArrowRight className="size-4" />
        </Link>
      </GateShell>
    );
  }

  if (!s) {
    return (
      <GateShell icon={<Loader2 className="size-9 animate-spin text-white" />}>
        <p className="text-sm text-white/55">Подключаюсь к комнате…</p>
      </GateShell>
    );
  }

  const meScore = s.scores.find((x) => x.playerId === meId);

  /* -------------------------------- sound gate -------------------------------- */
  if (!soundOn && s.status !== "lobby") {
    return (
      <GateShell icon={<Headphones className="size-9 text-white" />}>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
          Врубай <span className="text-grad">звук</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-white/55">
          Треки будут включаться автоматически и одновременно у всех. Нажми
          кнопку — браузер разрешит звук, и больше ничего трогать не нужно
          (кроме треков со Spotify и Яндекса — там play жмём вручную).
        </p>
        <button
          type="button"
          onClick={async () => {
            await loadYouTubeApi().catch(() => undefined);
            setSoundOn(true);
          }}
          className="group mt-8 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-neon to-viol px-10 py-4 font-display text-base font-bold shadow-[0_15px_50px_-10px_rgba(255,46,136,0.8)] transition-transform hover:scale-105 active:scale-95"
        >
          <Play className="size-5" /> Я в игре, звук включён
        </button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-white/35">
          <Wifi className="size-3.5" /> онлайн в комнате: {s.onlineCount}
        </p>
      </GateShell>
    );
  }

  /* --------------------------------- lobby wait -------------------------------- */
  if (s.status === "lobby") {
    return (
      <GateShell icon={<Disc3 className="size-9 animate-spin text-white [animation-duration:3s]" />}>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
          Игра ещё <span className="text-grad">не началась</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-white/55">
          Как только кто-нибудь в лобби нажмёт «Начать викторину», всё включится
          здесь автоматически. Страницу можно не закрывать.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Equalizer color="var(--color-aqua)" />
          <span className="text-xs text-white/40">
            ждём старта · онлайн {s.onlineCount}
          </span>
        </div>
        <Link
          href="/lobby"
          className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10"
        >
          В лобби
        </Link>
      </GateShell>
    );
  }

  const startAtMs =
    s.status === "countdown"
      ? (s.phaseEndsAt ?? now)
      : (s.phaseEndsAt ?? now) - s.maxRoundS * 1000;
  const secondsLeft = s.phaseEndsAt
    ? Math.max(0, Math.ceil((s.phaseEndsAt - now) / 1000))
    : 0;
  const elapsedS = Math.max(0, Math.floor((now - startAtMs) / 1000));
  const answerProgress =
    s.eligible > 0 ? Math.min(1, s.answersCount / s.eligible) : 0;
  // While the track plays the bar tracks answers, not time.
  const phaseFraction =
    s.status === "playing"
      ? answerProgress
      : s.phaseEndsAt
        ? Math.min(
            1,
            Math.max(
              0,
              (s.phaseEndsAt - now) /
                ((s.status === "countdown" ? s.countdownS : s.revealS) * 1000),
            ),
          )
        : 0;
  const waitingFor = Math.max(0, s.eligible - s.answersCount);
  const iAmDone = Boolean(s.myAnswer) || s.isOwner;

  /* ---------------------------------- finished --------------------------------- */
  if (s.status === "finished") {
    const max = Math.max(...s.scores.map((x) => x.points), 1);
    const winner = s.scores[0];
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto mb-5 grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-lime to-aqua shadow-[0_0_60px_-10px_rgba(163,230,53,0.6)]">
            <Crown className="size-10 text-ink" />
          </div>
          <h1 className="font-display text-4xl font-black tracking-tight sm:text-6xl">
            <span className="text-grad">Финиш!</span>
          </h1>
          {winner && (
            <p className="mt-4 text-white/55">
              Лучший музыкальный детектив —{" "}
              <span
                className="font-display font-bold"
                style={{ color: winner.color }}
              >
                {winner.name}
              </span>{" "}
              · {winner.points} очков
            </p>
          )}
          <p className="mt-2 flex items-center justify-center gap-2 text-xs text-white/35">
            <Check className="size-3.5 text-lime" /> игра сохранена в историю
          </p>
        </motion.div>

        <div className="mt-10 space-y-2.5">
          {s.scores.map((row, i) => (
            <motion.div
              key={row.playerId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.1 }}
              className={`glass relative overflow-hidden rounded-2xl p-4 ${
                row.playerId === meId ? "ring-1 ring-white/25" : ""
              }`}
            >
              <motion.div
                className="absolute inset-y-0 left-0 opacity-15"
                style={{ background: row.color }}
                initial={{ width: 0 }}
                animate={{ width: `${(row.points / max) * 100}%` }}
                transition={{
                  delay: 0.45 + i * 0.1,
                  type: "spring",
                  stiffness: 60,
                  damping: 18,
                }}
              />
              <div className="relative flex items-center gap-4">
                <span className="font-display w-7 text-center text-sm font-bold text-white/35">
                  {i + 1}
                </span>
                <span
                  className="font-display grid size-11 place-items-center rounded-2xl text-lg font-bold"
                  style={{ background: row.color }}
                >
                  {row.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {row.name}
                    {i === 0 && <Crown className="size-4 text-lime" />}
                    {row.playerId === meId && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white/60 uppercase">
                        ты
                      </span>
                    )}
                  </div>
                </div>
                <span className="font-display text-2xl font-black">
                  {row.points}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            onClick={playAgain}
            disabled={busy}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-viol px-7 py-3.5 text-sm font-bold shadow-[0_10px_40px_-10px_rgba(255,46,136,0.7)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Ещё партию
          </button>
          <button
            type="button"
            onClick={toLobby}
            disabled={busy}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10"
          >
            <Music2 className="size-4" /> В лобби (сменить треки)
          </button>
          <Link
            href="/history"
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10"
          >
            <History className="size-4" /> История игр
          </Link>
        </motion.div>
      </div>
    );
  }

  /* ---------------------------- countdown / playing / reveal --------------------------- */
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6">
      {/* header */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="font-display text-sm font-bold tracking-widest text-white/60">
          ТРЕК {pad(s.roundIndex + 1)}{" "}
          <span className="text-white/25">/ {pad(s.totalRounds)}</span>
        </div>
        <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70">
          {s.status === "playing" ? (
            <>
              <Users className="size-4 text-aqua" />
              ответили {s.answersCount} / {s.eligible}
            </>
          ) : (
            <>
              <Timer className="size-4 text-neon" />
              {s.status === "countdown" ? "старт" : `разгадка · ${secondsLeft}с`}
            </>
          )}
        </div>
      </div>
      <div className="mb-7 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon via-viol to-aqua transition-[width] duration-200 ease-linear"
          style={{ width: `${phaseFraction * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        {/* COUNTDOWN */}
        {s.status === "countdown" && (
          <motion.section
            key={`countdown-${s.roundIndex}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="glass relative flex min-h-[380px] flex-col items-center justify-center overflow-hidden rounded-[2rem] p-8 text-center"
          >
            {s.song && (
              <div className="absolute top-6 left-6">
                <ProviderChip provider={s.song.provider as MusicProvider} />
              </div>
            )}
            <p className="text-sm font-semibold tracking-[0.3em] text-white/40 uppercase">
              приготовься
            </p>
            <motion.div
              key={secondsLeft}
              initial={{ scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-display my-4 text-[7rem] leading-none font-black text-grad sm:text-[9rem]"
            >
              {secondsLeft}
            </motion.div>
            <p className="max-w-xs text-sm text-white/50">
              {s.song?.provider === "youtube"
                ? "Трек включится сам — просто слушай"
                : `Это ${
                    s.song?.provider === "spotify" ? "Spotify" : "Яндекс Музыка"
                  } — как только пойдёт время, жми play в плеере`}
            </p>
          </motion.section>
        )}

        {/* PLAYING */}
        {s.status === "playing" && s.song && (
          <motion.section
            key={`playing-${s.roundIndex}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-8"
          >
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[30rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
              style={{ background: meScore?.color ?? "#8B5CF6" }}
            />

            <div className="relative mb-4 flex items-center justify-between gap-3">
              <ProviderChip provider={s.song.provider as MusicProvider} />
              <span className="text-xs text-white/35">
                {s.song.provider === "youtube"
                  ? "звук без картинки — так честнее"
                  : "жми play в плеере"}
              </span>
            </div>

            <div className="relative">
              {s.song.provider === "youtube" ? (
                <SyncedYouTube
                  key={s.song.id}
                  videoId={s.song.providerId}
                  startAtMs={startAtMs}
                  offsetRef={offsetRef}
                  accent={meScore?.color ?? "#8B5CF6"}
                  onEnded={() => setTrackEnded(true)}
                />
              ) : (
                <NativeAudioEmbed
                  key={s.song.id}
                  provider={s.song.provider as MusicProvider}
                  embedUrl={s.song.embedUrl}
                />
              )}
            </div>

            {/* answers zone */}
            <div className="relative mt-6 border-t border-white/8 pt-6">
              {iAmDone ? (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  {s.isOwner ? (
                    <>
                      <EyeOff className="size-6 text-white/40" />
                      <p className="font-display text-lg font-bold">
                        Тс-с-с… это твой трек!
                      </p>
                    </>
                  ) : s.myAnswer?.correct ? (
                    <span className="flex items-center gap-2 rounded-full bg-lime/15 px-5 py-2.5 font-display text-lg font-bold text-lime">
                      <Check className="size-5" /> Верно! +{s.myAnswer.points}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 rounded-full bg-neon/15 px-5 py-2.5 font-display text-lg font-bold text-neon">
                      <X className="size-5" /> Мимо
                    </span>
                  )}

                  {waitingFor > 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="flex items-center gap-2 text-sm text-white/55">
                        <Equalizer active color="var(--color-aqua)" bars={3} />
                        Музыка играет — ждём ещё{" "}
                        <span className="font-bold text-white">
                          {waitingFor}
                        </span>{" "}
                        {waitingFor === 1 ? "игрока" : "игроков"}
                      </p>
                      <p className="text-xs text-white/35">
                        раунд закончится, как только ответят все
                        {trackEnded && " · трек уже доиграл"}
                      </p>
                      <button
                        type="button"
                        onClick={showAnswer}
                        disabled={skipping}
                        className={`mt-1 flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition-all ${
                          trackEnded
                            ? "animate-glow-pulse bg-white text-ink hover:scale-105"
                            : "border border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {skipping ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <SkipForward className="size-3.5" />
                        )}
                        Не ждать — показать ответ
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-white/40">
                      все ответили · показываю разгадку…
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="mb-4 text-center font-display text-sm font-bold tracking-[0.3em] text-white/40 uppercase">
                    Чей это трек?
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {s.players
                      .filter((p) => p.id !== meId)
                      .map((p) => (
                        <AnswerButton
                          key={p.id}
                          player={p}
                          pending={pendingGuess === p.id}
                          disabled={Boolean(pendingGuess)}
                          onClick={() => answer(p.id)}
                        />
                      ))}
                  </div>
                  <p className="mt-4 text-center text-xs text-white/35">
                    Трек играет целиком · чем быстрее ответишь, тем больше
                    очков (до +150) · идёт{" "}
                    {Math.floor(elapsedS / 60)}:{pad(elapsedS % 60)}
                  </p>
                </>
              )}
            </div>
          </motion.section>
        )}

        {/* REVEAL */}
        {s.status === "reveal" && s.songInfo && (
          <motion.section
            key={`reveal-${s.roundIndex}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-8"
          >
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[30rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
              style={{ background: s.songInfo.ownerColor }}
            />

            <div className="relative flex flex-wrap items-center gap-5">
              {s.songInfo.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.songInfo.thumbnail}
                  alt=""
                  className="size-24 rounded-3xl object-cover shadow-2xl sm:size-28"
                />
              ) : (
                <span className="grid size-24 shrink-0 place-items-center rounded-3xl bg-white/8 sm:size-28">
                  <Music2 className="size-10 text-white/40" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1.5">
                  {s.isOwner ? (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-widest text-white/70 uppercase">
                      Твой трек
                    </span>
                  ) : s.myAnswer?.correct ? (
                    <span className="flex w-fit items-center gap-1.5 rounded-full bg-lime/15 px-3 py-1 text-xs font-bold tracking-widest text-lime uppercase">
                      <Check className="size-3.5" /> Верно +{s.myAnswer.points}
                    </span>
                  ) : s.myAnswer ? (
                    <span className="flex w-fit items-center gap-1.5 rounded-full bg-neon/15 px-3 py-1 text-xs font-bold tracking-widest text-neon uppercase">
                      <X className="size-3.5" /> Мимо
                    </span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-widest text-white/60 uppercase">
                      Ты не успел ответить
                    </span>
                  )}
                </div>
                <div className="font-display truncate text-xl font-bold sm:text-2xl">
                  {s.songInfo.title}
                </div>
                <div className="truncate text-sm text-white/50">
                  {s.songInfo.artist || "исполнитель неизвестен"}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-white/50">
                    {s.songInfo.owners.length > 1
                      ? "Общий трек —"
                      : "Это трек"}
                  </span>
                  {s.songInfo.owners.map((o) => (
                    <span
                      key={o.id}
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-xs font-bold"
                      style={{ background: `${o.color}22`, color: o.color }}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ background: o.color }}
                      />
                      {o.name}
                    </span>
                  ))}
                </div>
                {s.songInfo.owners.length > 1 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-aqua">
                    <Users className="size-3.5" />
                    Совпадение вкусов! Засчитан любой из них
                  </div>
                )}
              </div>
              {s.song && (
                <ProviderChip provider={s.song.provider as MusicProvider} />
              )}
            </div>

            {s.guesses && s.guesses.length > 0 && (
              <div className="relative mt-6 space-y-1.5 border-t border-white/8 pt-5">
                {s.guesses.map((g) => (
                  <div
                    key={g.guesserId}
                    className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm"
                  >
                    <span
                      className="font-display grid size-7 place-items-center rounded-lg text-xs font-bold"
                      style={{ background: g.guesserColor }}
                    >
                      {g.guesserName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="font-medium">{g.guesserName}</span>
                    <span className="text-white/35">→ {g.guessedName}</span>
                    <span className="ml-auto flex items-center gap-2 text-xs text-white/40">
                      {(g.elapsedMs / 1000).toFixed(1)}с
                      {g.correct ? (
                        <span className="flex items-center gap-1 font-bold text-lime">
                          <Check className="size-3.5" />+{g.points}
                        </span>
                      ) : (
                        <X className="size-4 text-neon/70" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="relative mt-5 text-center text-xs text-white/35">
              {s.roundIndex + 1 < s.totalRounds
                ? `следующий трек через ${secondsLeft}с`
                : "Итоги через пару секунд…"}
            </p>
          </motion.section>
        )}
      </AnimatePresence>

      {/* live leaderboard */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/40">
        {s.scores.map((row) => (
          <span
            key={row.playerId}
            className={`flex items-center gap-1.5 ${
              row.playerId === meId ? "text-white/80" : ""
            }`}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: row.color }}
            />
            {row.name}{" "}
            <span className="font-display font-bold">{row.points}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function GateShell({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full rounded-[2rem] p-10"
      >
        <div className="mx-auto mb-6 grid size-18 place-items-center rounded-2xl bg-gradient-to-br from-neon to-viol p-4 shadow-[0_0_40px_rgba(255,46,136,0.4)]">
          {icon}
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function AnswerButton({
  player,
  pending,
  disabled,
  onClick,
}: {
  player: PlayerLite;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled && !pending}
      onClick={onClick}
      className={`glass flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 active:scale-95 ${
        pending
          ? "border-aqua/60 bg-aqua/10"
          : "border-white/10 enabled:hover:scale-[1.03] enabled:hover:border-white/30 disabled:opacity-45"
      }`}
    >
      <span
        className="font-display grid size-10 shrink-0 place-items-center rounded-xl text-base font-bold"
        style={{ background: player.color }}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          player.name.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {player.name}
      </span>
    </button>
  );
}

function NativeAudioEmbed({
  provider,
  embedUrl,
}: {
  provider: MusicProvider;
  embedUrl: string;
}) {
  const [tapped, setTapped] = useState(false);
  const src =
    provider === "spotify"
      ? `${embedUrl}?utm_source=generator&theme=0`
      : embedUrl;
  return (
    <div className="flex flex-col items-center gap-4">
      <iframe
        src={src}
        className="w-full max-w-md rounded-2xl border-0"
        height={provider === "spotify" ? 152 : 150}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        title={`${provider} player`}
        onLoad={() => setTapped(false)}
      />
      <button
        type="button"
        onClick={() => setTapped(true)}
        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
          tapped
            ? "bg-white/10 text-white/40"
            : "animate-glow-pulse bg-white text-ink hover:scale-105"
        }`}
      >
        <Play className="size-4" />
        {tapped ? "Слушай и угадывай!" : "Нажми play в плеере выше ↑"}
      </button>
    </div>
  );
}
