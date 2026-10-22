export default function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* base vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,#12122a_0%,#06060c_55%,#040409_100%)]" />

      {/* colored blobs */}
      <div className="absolute -top-40 left-1/2 h-[34rem] w-[54rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.28),transparent)] blur-3xl" />
      <div className="absolute top-1/3 -left-56 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,46,136,0.2),transparent)] blur-3xl" />
      <div className="absolute -right-56 bottom-0 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(closest-side,rgba(34,211,238,0.16),transparent)] blur-3xl" />

      {/* fine grid */}
      <div
        className="absolute inset-0 opacity-[0.05] [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* film grain */}
      <div className="app-noise absolute inset-0 opacity-[0.05] mix-blend-overlay" />
    </div>
  );
}
