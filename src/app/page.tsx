import { getPlayersWithSongs } from "@/lib/data";
import Landing from "@/components/landing";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const players = await getPlayersWithSongs();
  const songsCount = players.reduce((n, p) => n + p.songs.length, 0);
  return <Landing playersCount={players.length} songsCount={songsCount} />;
}
