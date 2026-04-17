import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { filterPlayersByTeamAndSearch } from "../lib/filterPlayers";
import type { ApiPlayer } from "../types";
import PlayerCard2 from "../components/PlayerCard2";

export function MarketPage() {
  const [players, setPlayers] = useState<ApiPlayer[]>([]);
  const [team, setTeam] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadFinished, setLoadFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<ApiPlayer[]>("/api/players");
        if (!cancelled) setPlayers(data);
      } catch {
        if (!cancelled) setError("Failed to load players");
      } finally {
        if (!cancelled) setLoadFinished(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const teams = useMemo(() => {
    const s = new Set<string>();
    for (const p of players) s.add(p.team);
    return ["ALL", ...Array.from(s).sort()];
  }, [players]);

  const filtered = useMemo(
    () => filterPlayersByTeamAndSearch(players, team, search),
    [players, team, search],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Player market</h1>
        <p className="mt-1 text-sm text-slate-300">Browse the pool, filter by team, and search by name.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-200">
          Team
          <select
            className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          >
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-sm text-slate-200 sm:min-w-[16rem]">
          Search name
          <input
            type="search"
            placeholder="Type a player or team…"
            className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </label>
      </div>

      {error ? <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

      {loadFinished && !error && players.length === 0 ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          No players in the database yet. From <code className="rounded bg-black/30 px-1">mun-fantasy/backend</code> run{" "}
          <code className="rounded bg-black/30 px-1">npm run db:seed</code> with <code className="rounded bg-black/30 px-1">DATABASE_URL</code> pointing at
          production (Neon). That loads the JSON teams and also resets fantasy squads and matches—see the README.
        </div>
      ) : null}

      {loadFinished && !error && filtered.length === 0 && players.length > 0 ? (
        <p className="text-center text-sm text-slate-400">No players match this team or search.</p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-4">
        {filtered.map((p) => (
          <PlayerCard2 key={p.id} player={p} />
        ))}
      </div>
    </div>
  );
}
