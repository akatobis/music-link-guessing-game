import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Unbounded, Onest } from "next/font/google";
import "./globals.css";
import Background from "@/components/background";
import Header from "@/components/header";

const display = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
});

const body = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
});

export const metadata: Metadata = {
  title: "Чей трек? — музыкальная викторина для друзей",
  description:
    "Каждый добавляет 10 любимых треков ссылками с YouTube, Spotify или Яндекс Музыки. Сайт перемешивает их, по одному включает — а вы угадываете, чей это трек.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen overflow-x-hidden bg-ink font-body text-white antialiased">
        <Background />
        <Header />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
