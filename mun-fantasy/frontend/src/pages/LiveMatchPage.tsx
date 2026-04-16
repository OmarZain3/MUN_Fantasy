import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { ApiMatch, MatchEvent } from "../types";

export function LiveMatchPage() {
  const { matchId } = useParams();
  const [match, setMatch] = useState<ApiMatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get<ApiMatch>(`/api/matches/${matchId}`);
        if (!cancelled) setMatch(data);
      } catch {
        if (!cancelled) setError("Failed to load match");
      }
    })();

    const socket = getSocket();
    socket.emit("join_match", matchId);

    const onUpdate = (payload: { match: ApiMatch }) => {
      if (payload?.match?.id === matchId) setMatch(payload.match);
    };

    socket.on("match_update", onUpdate);
    socket.on("goal_added", onUpdate);
    socket.on("card_added", onUpdate);

    return () => {
      cancelled = true;
      socket.emit("leave_match", matchId);
      socket.off("match_update", onUpdate);
      socket.off("goal_added", onUpdate);
      socket.off("card_added", onUpdate);
    };
  }, [matchId]);

  const events = useMemo(() => (match?.events ?? []) as MatchEvent[], [match]);

  if (!matchId) {
    return <div className="text-slate-200">Missing match id.</div>;
  }

  if (error) {
    return <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>;
  }

  if (!match) {
    return <div className="text-slate-200">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Link className="text-sm text-emerald-300 hover:underline" to="/live">
          ← All live matches
        </Link>
        <h1 className="text-2xl font-semibold text-white">
          {match.teamA} vs {match.teamB}
        </h1>
        <div className="text-sm text-slate-300">
          Court {match.court} · {match.status}
        </div>
        <div className="flex flex-col items-center gap-1 pt-1">
          <div className="text-xs uppercase tracking-wide text-slate-400">Score</div>
          <div className="inline-flex items-baseline gap-2 tabular-nums">
            <span className="min-w-[2ch] text-right text-4xl font-bold text-white">{match.scoreTeamA}</span>
            <span className="select-none text-3xl font-normal text-slate-500">–</span>
            <span className="min-w-[2ch] text-left text-4xl font-bold text-white">{match.scoreTeamB}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold text-white">Events timeline</div>
        <div className="mt-3 space-y-2">
          {events.length === 0 ? (
            <div className="text-sm text-slate-300">No events yet.</div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 rounded-xl bg-black/20 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm text-white">
                    <span className="font-semibold">{e.player.name}</span>{" "}
                    <span className="text-slate-300">({e.player.team})</span>
                  </div>
                  <div className="text-xs text-slate-400">{e.type.replaceAll("_", " ")}</div>
                </div>
                <div className="shrink-0 text-sm tabular-nums text-slate-200">{`${e.minute}'`}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
