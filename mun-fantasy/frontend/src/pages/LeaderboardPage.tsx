import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Row = { rank: number; fantasyTeamId: string; name: string; ownerEmail: string; points: number };

export function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<Row[]>("/api/leaderboard");
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setError("Failed to load leaderboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Leaderboard</h1>
        <p className="mt-1 text-sm text-slate-300">Points include captain multiplier (×2) for starters only.</p>
      </div>
      {error ? <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3 text-right">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-white/5">
            {rows.map((r) => (
              <tr key={r.fantasyTeamId} className="text-slate-100">
                <td className="px-4 py-3 tabular-nums text-slate-300">{r.rank}</td>
                <td className="px-4 py-3 font-semibold text-white">{r.name}</td>
                <td className="px-4 py-3 text-slate-300">{r.ownerEmail}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-white">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
