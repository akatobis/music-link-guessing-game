import { PROVIDER_META, type MusicProvider } from "@/lib/providers";
import { SpotifyIcon, YandexMusicIcon, YoutubeIcon } from "./icons";

export function ProviderIcon({
  provider,
  className = "size-3.5",
}: {
  provider: MusicProvider;
  className?: string;
}) {
  if (provider === "youtube") return <YoutubeIcon className={className} />;
  if (provider === "spotify") return <SpotifyIcon className={className} />;
  return <YandexMusicIcon className={className} />;
}

export function ProviderChip({
  provider,
  compact = false,
}: {
  provider: MusicProvider;
  compact?: boolean;
}) {
  const meta = PROVIDER_META[provider];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide"
      style={{
        borderColor: `${meta.color}55`,
        background: `${meta.color}14`,
        color: meta.color,
      }}
    >
      <ProviderIcon provider={provider} />
      {!compact && meta.label}
      {compact && meta.short}
    </span>
  );
}
