export const PLAYER_COLORS = [
  "#FF2E88",
  "#22D3EE",
  "#A3E635",
  "#8B5CF6",
  "#F97316",
  "#FACC15",
  "#34D399",
  "#FB7185",
  "#60A5FA",
  "#E879F9",
] as const;

export function defaultColor(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}
