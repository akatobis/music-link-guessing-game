import { NextResponse } from "next/server";
import { forceReveal, getOrCreateState } from "@/lib/live";

export const dynamic = "force-dynamic";

/** Manual "show the answer" — used when someone is AFK or the track ended. */
export async function POST() {
  const st = await getOrCreateState();
  if (st.status !== "playing") {
    return NextResponse.json({ error: "not_playing" }, { status: 409 });
  }
  const next = await forceReveal(st.roundIndex);
  return NextResponse.json({ ok: true, status: next.status });
}
