import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { ApiMatch } from "../types";

export function LiveHubPage() {
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<ApiMatch[]>("/api/matches/live");
        if (!cancelled) setMatches(data);
      } catch {
        if (!cancelled) setError("Failed to load live matches");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Live matches</h1>
        <p className="mt-1 text-sm text-slate-300">Open a match to follow the timeline in real time.</p>
      </div>
      {error ? <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
      {matches.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-200">
          No live matches right now. Ask an admin to move a match to LIVE.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {matches.map((m) => (
            <Link
              key={m.id}
              to={`/live/${m.id}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center hover:bg-white/10"
            >
              <div className="text-sm text-slate-300">
                {m.teamA} vs {m.teamB}
              </div>
              <div className="mt-3 flex justify-center">
                <div className="inline-flex items-baseline gap-2 tabular-nums">
                  <span className="min-w-[2ch] text-right text-3xl font-bold text-white">{m.scoreTeamA}</span>
                  <span className="select-none text-2xl font-normal text-slate-500">–</span>
                  <span className="min-w-[2ch] text-left text-3xl font-bold text-white">{m.scoreTeamB}</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Court {m.court} · {m.status}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
