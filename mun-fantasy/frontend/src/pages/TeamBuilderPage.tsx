import { useCallback, useEffect, useMemo, useState } from "react";
import { Bench } from "@/components/Bench";
import { Pitch } from "@/components/Pitch";
import PlayerCard2 from "@/components/PlayerCard2";
import { GUC_MUN_PLAYER_CARD_SRC } from "@/lib/gucLogos";
import { api } from "@/lib/api";
import type { ApiPlayer, FantasyTeamResponse, FantasyTeamPlayer } from "@/types";

const MAX_SQUAD = 7;
const MAX_XI = 5;
const MAX_BENCH = 2;

type SettingsDto = { transferMarketOpen: boolean };

export function TeamBuilderPage() {
  const [players, setPlayers] = useState<ApiPlayer[]>([]);
  const [teamName, setTeamName] = useState("My MUN XI");
  const [fantasy, setFantasy] = useState<FantasyTeamResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [transferMarketOpen, setTransferMarketOpen] = useState(true);
  const [poolLoadFinished, setPoolLoadFinished] = useState(false);

  async function refresh() {
    try {
      const { data } = await api.get<FantasyTeamResponse>("/api/fantasy/team");
      setFantasy(data);
    } catch {
      setFantasy(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: ps }, { data: st }] = await Promise.all([
          api.get<ApiPlayer[]>("/api/players"),
          api.get<SettingsDto>("/api/settings"),
        ]);
        if (!cancelled) {
          setPlayers(ps);
          setTransferMarketOpen(st.transferMarketOpen);
        }
        await refresh();
      } catch {
        if (!cancelled) setError("Failed to load data");
      } finally {
        if (!cancelled) setPoolLoadFinished(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rosterLocked = !transferMarketOpen;

  const squadIds = useMemo(() => new Set((fantasy?.players ?? []).map((x) => x.playerId)), [fantasy]);

  const startersCount = useMemo(
    () => (fantasy?.players ?? []).filter((x) => !x.isSub).length,
    [fantasy],
  );

  const startersOnly = useMemo(() => (fantasy?.players ?? []).filter((x) => !x.isSub), [fantasy]);
  const starterPlayers = useMemo(() => startersOnly.map((x) => x.player), [startersOnly]);
  const benchRows = useMemo(() => (fantasy?.players ?? []).filter((x) => x.isSub), [fantasy]);
  const benchPlayers = useMemo(() => benchRows.map((r) => r.player), [benchRows]);
  const squadHasGk = useMemo(() => (fantasy?.players ?? []).some((x) => x.player.isGK), [fantasy]);
  const captainId = useMemo(() => fantasy?.players.find((x) => x.isCaptain)?.playerId ?? "", [fantasy]);

  const scrollToPool = useCallback(() => {
    document.getElementById("player-pool")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function createTeam() {
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/fantasy/team", { name: teamName });
      await refresh();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function addPlayer(playerId: string) {
    setError(null);
    setBusy(true);
    try {
      const isSub = startersCount >= MAX_XI;
      await api.post("/api/fantasy/players", { playerId, isSub });
      await refresh();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function removePlayer(playerId: string) {
    setError(null);
    setBusy(true);
    try {
      await api.delete(`/api/fantasy/players/${playerId}`);
      if (selectedSubId === playerId) setSelectedSubId(null);
      await refresh();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function makeCaptain(playerId: string) {
    setError(null);
    setBusy(true);
    try {
      await api.post("/api/fantasy/captain", { playerId });
      await refresh();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleSub(row: FantasyTeamPlayer) {
    setError(null);
    setBusy(true);
    try {
      await api.patch(`/api/fantasy/players/${row.playerId}/sub`, { isSub: !row.isSub });
      await refresh();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  function rowByPlayerId(playerId: string, isSub: boolean) {
    return fantasy?.players.find((x) => x.playerId === playerId && x.isSub === isSub);
  }

  async function benchFromPitch(playerId: string) {
    if (benchRows.length >= MAX_BENCH) return;
    const row = rowByPlayerId(playerId, false);
    if (row) await toggleSub(row);
  }

  async function promoteFromBench(playerId: string) {
    const row = rowByPlayerId(playerId, true);
    if (row) await toggleSub(row);
  }

  const squadCount = fantasy?.players.length ?? 0;

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-start">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* <img
            src={GUC_MUN_HEADER_SRC}
            alt="GUC MUN"
            className="h-16 w-auto max-w-[min(300px,88vw)] shrink-0 object-contain object-left sm:h-[4.5rem]"
          /> */}
          <img
            src={GUC_MUN_PLAYER_CARD_SRC}
            alt=""
            className="hidden h-12 w-12 shrink-0 object-contain sm:block sm:h-14 sm:w-14"
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-white">Fantasy team builder</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">
            <span className="font-semibold text-[#F8ECA7]">5</span> on pitch (2-2-1) +{" "}
            <span className="font-semibold text-[#F8ECA7]">2</span> bench ={" "}
            <span className="font-semibold text-[#F8ECA7]">7</span> players max. One goalkeeper per squad.
          </p>
        </div>
      </div>

      {error ? <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

      {fantasy && rosterLocked ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span className="font-semibold">Transfer market is closed.</span> You cannot add, drop, or move players
          until an admin turns it back on. You can still change captain.
        </div>
      ) : null}

      {!fantasy ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">Create your fantasy team</div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block flex-1 text-sm text-slate-200">
              Team name
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={createTeam}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              Create team
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm text-slate-300">Squad</div>
              <div className="text-lg font-semibold text-white">
                {fantasy.name}{" "}
                <span className="text-sm font-normal text-slate-300">
                  ({squadCount}/{MAX_SQUAD}) pitch {Math.min(startersCount, MAX_XI)}/{MAX_XI} · bench{" "}
                  {benchRows.length}/{MAX_BENCH}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Computed points</div>
              <div className="text-2xl font-bold tabular-nums text-white">{fantasy.computedPoints}</div>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#F8ECA7]">Pitch (2-2-1)</h2>
            <Pitch
              players={starterPlayers}
              captainId={captainId}
              onSlotAdd={scrollToPool}
              onSetCaptain={(id) => void makeCaptain(id)}
              disabled={busy}
              rosterLocked={rosterLocked}
              onBenchStarter={(id) => void benchFromPitch(id)}
              onRemoveStarter={(id) => void removePlayer(id)}
              canBenchStarter={benchRows.length < MAX_BENCH}
            />
          </div>

          <Bench
            subs={benchPlayers}
            onAdd={scrollToPool}
            selectedSubId={selectedSubId}
            onSelectSub={(id) => setSelectedSubId((cur) => (cur === id ? null : id))}
            disabled={busy}
            rosterLocked={rosterLocked}
            disableAdd={squadCount >= MAX_SQUAD || benchRows.length >= MAX_BENCH}
            onRemoveSub={(id) => void removePlayer(id)}
            onPromoteSub={(id) => void promoteFromBench(id)}
          />

          {fantasy.players.length === 0 ? (
            <div className="text-sm text-slate-300">Your squad is empty. Add players from the pool below.</div>
          ) : null}
        </div>
      )}

      <div id="player-pool" className="text-left">
        <h2 className="text-lg font-semibold text-white">Player pool</h2>
        <p className="mt-1 text-sm text-slate-400">Tap a card to add or remove from your squad.</p>
        {poolLoadFinished && !error && players.length === 0 ? (
          <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            The pool is empty until the database is seeded. From <code className="rounded bg-black/30 px-1">mun-fantasy/backend</code> run{" "}
            <code className="rounded bg-black/30 px-1">npm run db:seed</code> with your production <code className="rounded bg-black/30 px-1">DATABASE_URL</code>{" "}
            (see README). Seeding clears existing fantasy lineups and matches.
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap justify-center gap-4">
          {players.map((p) => {
            const inSquad = squadIds.has(p.id);
            const gkBlocked = p.isGK && squadHasGk && !inSquad;
            const baseDisabled =
              !fantasy || Boolean(fantasy && !inSquad && squadCount >= MAX_SQUAD) || gkBlocked;
            const disabled = baseDisabled || Boolean(fantasy && rosterLocked);
            return (
              <PlayerCard2
                key={p.id}
                player={p}
                selected={inSquad}
                disabled={disabled}
                onSelect={
                  fantasy && !rosterLocked
                    ? () => {
                        if (inSquad) void removePlayer(p.id);
                        else void addPlayer(p.id);
                      }
                    : undefined
                }
                actionLabel={
                  rosterLocked && fantasy
                    ? "Market closed"
                    : gkBlocked
                      ? "GK taken"
                      : inSquad
                        ? "In squad"
                        : fantasy
                          ? "Tap to add"
                          : "Create team first"
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
