import { getLobbyPlayersLite } from "@/lib/data";
import LobbyClient from "@/components/lobby/lobby-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Лобби — Чей трек?",
};

export default async function LobbyPage() {
  const players = await getLobbyPlayersLite();
  return <LobbyClient initial={players} />;
}
