export function Vinyl({
  spinning = false,
  label = "#FF2E88",
  size = 220,
  className = "",
}: {
  spinning?: boolean;
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* glow */}
      <div
        className="absolute inset-[-14%] rounded-full opacity-60 blur-2xl transition-opacity duration-700"
        style={{
          background: `radial-gradient(closest-side, ${label}55, transparent)`,
          opacity: spinning ? 0.8 : 0.35,
        }}
      />
      <div
        className="vinyl-groove relative h-full w-full rounded-full border border-white/10 shadow-[inset_0_0_40px_rgba(0,0,0,0.8),0_24px_60px_-20px_rgba(0,0,0,0.9)]"
        style={{
          animation: `spin-disc 8s linear infinite`,
          animationPlayState: spinning ? "running" : "paused",
        }}
      >
        {/* shine */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 200deg, transparent 0deg, rgba(255,255,255,0.09) 18deg, transparent 40deg, transparent 180deg, rgba(255,255,255,0.06) 205deg, transparent 230deg)",
          }}
        />
        {/* label */}
        <div
          className="absolute top-1/2 left-1/2 grid aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-black/40"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${label}, ${label}CC 60%, #111 130%)`,
          }}
        >
          <div className="size-[10%] min-w-2 min-h-2 rounded-full bg-ink/90 ring-2 ring-white/25" />
        </div>
      </div>
    </div>
  );
}
