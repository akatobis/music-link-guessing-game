export function Equalizer({
  active = true,
  color = "var(--color-neon)",
  bars = 5,
  className = "",
}: {
  active?: boolean;
  color?: string;
  bars?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`flex h-5 items-end gap-[3px] ${className}`}
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="h-full w-[3.5px] origin-bottom animate-eq rounded-full"
          style={{
            background: color,
            animationDelay: `${i * 0.12}s`,
            animationDuration: `${0.72 + (i % 3) * 0.18}s`,
            animationPlayState: active ? "running" : "paused",
            transform: active ? undefined : "scaleY(0.22)",
          }}
        />
      ))}
    </div>
  );
}
