"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  Link2,
  Music2,
  Play,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Vinyl } from "@/components/vinyl";
import { Equalizer } from "@/components/equalizer";
import { ProviderChip } from "@/components/provider-chip";

const TICKER = [
  "YouTube",
  "Spotify",
  "Яндекс Музыка",
  "10 треков каждому",
  "угадай, чей звучит",
  "без скачиваний — только ссылки",
  "очки за интуицию",
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Landing({
  playersCount,
  songsCount,
}: {
  playersCount: number;
  songsCount: number;
}) {
  return (
    <div className="overflow-hidden">
      {/* HERO */}
      <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-8">
        <div>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={0}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-[0.2em] text-white/60 uppercase"
          >
            <Sparkles className="size-3.5 text-neon" />
            Викторина для вашей тусовки
          </motion.div>

          <h1 className="font-display leading-[0.95] font-black tracking-tight">
            <motion.span
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={1}
              className="block text-outline text-[clamp(3.2rem,11vw,7.5rem)]"
            >
              ЧЕЙ
            </motion.span>
            <motion.span
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={2}
              className="text-grad block text-[clamp(3.2rem,11vw,7.5rem)]"
            >
              ТРЕК?
            </motion.span>
          </h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={3}
            className="mt-6 max-w-lg text-base text-white/60 sm:text-lg"
          >
            Каждый заходит со своего устройства и добавляет до 10 любимых
            песен — просто ссылками с YouTube, Spotify или Яндекс Музыки. Потом
            треки звучат у всех одновременно, а вы наперегонки угадываете,{" "}
            <span className="font-semibold text-white">чей это трек</span>.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={4}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/lobby"
              className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-neon to-viol px-7 py-3.5 text-sm font-bold shadow-[0_10px_40px_-10px_rgba(255,46,136,0.7)] transition-transform hover:scale-[1.04] active:scale-95"
            >
              <Play className="size-4" />
              {playersCount > 0 ? "Продолжить в лобби" : "Собрать друзей"}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {playersCount > 0 && songsCount > 0 && (
              <Link
                href="/play"
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/80 transition-all hover:border-white/30 hover:bg-white/10"
              >
                Сразу играть
              </Link>
            )}
          </motion.div>

          {(playersCount > 0 || songsCount > 0) && (
            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={5}
              className="mt-5 flex items-center gap-2 text-xs text-white/40"
            >
              <span className="size-1.5 rounded-full bg-lime" />
              Сейчас в лобби: {playersCount}{" "}
              {playersCount === 1 ? "игрок" : playersCount < 5 ? "игрока" : "игроков"},{" "}
              {songsCount} {songsCount === 1 ? "трек" : songsCount < 5 ? "трека" : "треков"}
            </motion.p>
          )}
        </div>

        {/* hero art */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto hidden aspect-square w-full max-w-md items-center justify-center sm:flex"
        >
          <div className="animate-float">
            <Vinyl spinning size={320} label="#FF2E88" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="absolute -top-2 right-4 rotate-6"
          >
            <ProviderChip provider="youtube" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="absolute top-1/3 -left-2 -rotate-6"
          >
            <ProviderChip provider="spotify" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="absolute right-0 -bottom-2 rotate-3"
          >
            <ProviderChip provider="yandex" />
          </motion.div>

          <div className="glass absolute bottom-6 left-2 flex items-center gap-3 rounded-2xl px-4 py-3">
            <Equalizer color="var(--color-neon)" />
            <span className="text-xs font-medium text-white/60">
              в эфире — чей-то любимый трек
            </span>
          </div>
        </motion.div>
      </section>

      {/* TICKER */}
      <section className="relative border-y border-white/8 bg-white/[0.02] py-4">
        <div className="animate-marquee flex w-max items-center gap-8 pr-8 whitespace-nowrap">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span
              key={i}
              className="font-display flex items-center gap-8 text-sm font-bold tracking-[0.25em] text-white/35 uppercase"
            >
              {t}
              <span className="size-1.5 rounded-full bg-neon/60" />
            </span>
          ))}
        </div>
      </section>

      {/* STEPS */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl"
        >
          Как <span className="text-grad">играть</span>
        </motion.h2>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Users,
              num: "01",
              title: "Соберитесь в лобби",
              text: "Каждый заходит со своего компьютера или телефона и выбирает себя — никаких регистраций и паролей.",
              color: "#FF2E88",
            },
            {
              icon: Link2,
              num: "02",
              title: "Кидайте ссылки",
              text: "До 10 треков с YouTube, Spotify или Яндекс Музыки. Сайт сам подтянет название, исполнителя и обложку.",
              color: "#8B5CF6",
            },
            {
              icon: Trophy,
              num: "03",
              title: "Угадывайте наперегонки",
              text: "Треки включаются одновременно у всех. Отвечают все разом — верный ответ до +150 очков, чем быстрее, тем больше.",
              color: "#22D3EE",
            },
          ].map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.12, duration: 0.6 }}
              className="glass group relative overflow-hidden rounded-3xl p-7 transition-transform duration-300 hover:-translate-y-1.5"
            >
              <div
                className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
                style={{ background: s.color }}
              />
              <div className="flex items-center justify-between">
                <span
                  className="grid size-12 place-items-center rounded-2xl"
                  style={{ background: `${s.color}22`, color: s.color }}
                >
                  <s.icon className="size-6" />
                </span>
                <span className="font-display text-outline text-4xl font-black">
                  {s.num}
                </span>
              </div>
              <h3 className="font-display mt-6 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {s.text}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* PROVIDERS */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          className="glass relative overflow-hidden rounded-[2rem] p-8 sm:p-12"
        >
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.25),transparent)] blur-3xl" />
          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <ProviderChip provider="youtube" />
                <ProviderChip provider="spotify" />
                <ProviderChip provider="yandex" />
              </div>
              <h3 className="font-display mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Ничего скачивать не нужно
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-white/55 sm:text-base">
                Просто вставляешь ссылку — сайт распознаёт сервис, подхватывает
                трек и встраивает его в игру через встроенный плеер. В викторине
                звучат короткие случайные фрагменты, так что угадать не так
                просто.
              </p>
            </div>
            <Link
              href="/lobby"
              className="group flex shrink-0 items-center gap-3 rounded-full border border-white/15 bg-white/5 px-7 py-4 font-display text-sm font-bold transition-all hover:border-neon/60 hover:bg-neon/10"
            >
              <Music2 className="size-5 text-neon" />
              Начать сбор плейлиста
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/30">
        Сделано для вечеринок, квартирников и долгих дорог в машине
      </footer>
    </div>
  );
}
