import confetti from "canvas-confetti";

export function pop(color = "#FF2E88") {
  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 42,
    origin: { y: 0.6 },
    colors: [color, "#ffffff", "#22D3EE", "#8B5CF6"],
    disableForReducedMotion: true,
  });
}

export function celebrate() {
  const end = Date.now() + 900;
  const colors = ["#FF2E88", "#8B5CF6", "#22D3EE", "#A3E635", "#ffffff"];
  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
