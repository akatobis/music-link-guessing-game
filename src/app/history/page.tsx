import Link from "next/link";
import {
  Check,
  Crown,
  History as HistoryIcon,
  Music2,
  Play,
  X,
} from "lucide-react";
import { getGamesHistory } from "@/lib/data";
import { ProviderIcon } from "@/components/provider-chip";
import type { MusicProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "История игр — Чей трек?",
};

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function HistoryPage() {
  const history = await getGamesHistory(30);

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <div className="mb-10">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.25em] text-white/40 uppercase">
          <HistoryIcon className="size-3.5" /> Архив вечеринок
        </p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
          <span className="text-grad">История</span>
        </h1>
      </div>

      {history.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-white/8">
            <Music2 className="size-8 text-white/50" />
          </div>
          <h2 className="font-display text-xl font-bold">
            Ещё не сыграно ни одной игры
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
            Соберите друзей, накидайте треков и запустите первую викторину —
            результаты появятся здесь.
          </p>
          <Link
            href="/lobby"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-viol px-6 py-3 text-sm font-bold transition-transform hover:scale-105 active:scale-95"
          >
            <Play className="size-4" /> Собрать игру
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {history.map(({ game, rounds }) => {
            const scoreByGuesser = new Map<
              string,
              { name: string; points: number; color: string }
            >();
            for (const r of rounds) {
              const entry = scoreByGuesser.get(r.guesserName) ?? {
                name: r.guesserName,
                points: 0,
                color: r.guesserColor ?? "#FF2E88",
              };
              entry.points += r.points ?? (r.correct ? 1 : 0);
              scoreByGuesser.set(r.guesserName, entry);
            }
            const board = [...scoreByGuesser.values()].sort(
              (a, b) => b.points - a.points,
            );
            const winner = board[0];
            const correctCount = rounds.filter((r) => r.correct).length;

            return (
              <details
                key={game.id}
                className="glass group overflow-hidden rounded-3xl open:border-white/15"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-3 p-6 transition-colors hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
                  <div>
                    <div className="font-display text-lg font-bold">
                      {dateFmt.format(new Date(game.createdAt))}
                    </div>
                    <div className="text-xs text-white/40">
                      {game.totalRounds}{" "}
                      {game.totalRounds === 1
                        ? "трек"
                        : game.totalRounds < 5
                          ? "трека"
                          : "треков"}{" "}
                      · угадано {correctCount}
                    </div>
                  </div>

                  {winner && (
                    <div className="flex items-center gap-2 rounded-full border border-lime/30 bg-lime/10 px-4 py-2 text-sm font-semibold">
                      <Crown className="size-4 text-lime" />
                      {winner.name}
                      <span className="text-white/50">
                        · {winner.points}{" "}
                        {winner.points === 1
                          ? "очко"
                          : winner.points < 5
                            ? "очка"
                            : "очков"}
                      </span>
                    </div>
                  )}

                  <div className="ml-auto flex -space-x-2">
                    {board.slice(0, 6).map((b) => (
                      <span
                        key={b.name}
                        className="font-display grid size-8 place-items-center rounded-full border-2 border-panel text-xs font-bold"
                        style={{ background: b.color }}
                        title={b.name}
                      >
                        {b.name.slice(0, 1).toUpperCase()}
                      </span>
                    ))}
                  </div>
                </summary>

                <div className="border-t border-white/5 px-6 py-4">
                  <div className="space-y-1.5">
                    {rounds.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-white/[0.03]"
                      >
                        <span className="font-display w-6 text-xs font-bold text-white/25">
                          {r.position + 1}
                        </span>
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/5 text-white/45">
                          <ProviderIcon
                            provider={r.provider as MusicProvider}
                            className="size-3.5"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{r.songTitle}</span>
                          {r.songArtist && (
                            <span className="text-white/40">
                              {" "}
                              — {r.songArtist}
                            </span>
                          )}
                        </div>
                        <span
                          className="hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:flex"
                          style={{
                            background: `${r.ownerColor}18`,
                            color: r.ownerColor,
                          }}
                        >
                          {r.ownerName}
                        </span>
                        <span className="w-26 shrink-0 text-right text-xs text-white/40">
                          {r.guesserName}
                          {" → "}
                          {r.guessedName}
                        </span>
                        {r.correct ? (
                          <Check className="size-4 shrink-0 text-lime" />
                        ) : (
                          <X className="size-4 shrink-0 text-neon/70" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
