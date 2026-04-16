import { useEffect, useMemo, useState } from "react";
import { Bench } from "@/components/Bench";
import { Pitch } from "@/components/Pitch";
import { GUC_MUN_PLAYER_CARD_SRC } from "@/lib/gucLogos";
import { api } from "@/lib/api";
import type { FantasyTeamResponse } from "@/types";

export function MyTeamPage() {
  const [team, setTeam] = useState<FantasyTeamResponse | null>(null);
  const [transferMarketOpen, setTransferMarketOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: s } = await api.get<{ transferMarketOpen: boolean }>("/api/settings");
        if (!cancelled) setTransferMarketOpen(s.transferMarketOpen);
      } catch {
        /* ignore */
      }
      try {
        const { data: t } = await api.get<FantasyTeamResponse>("/api/fantasy/team");
        if (!cancelled) setTeam(t);
      } catch {
        if (!cancelled) setTeam(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startersOnly = useMemo(() => (team?.players ?? []).filter((x) => !x.isSub), [team]);
  const starterPlayers = useMemo(() => startersOnly.map((x) => x.player), [startersOnly]);
  const benchRows = useMemo(() => (team?.players ?? []).filter((x) => x.isSub), [team]);
  const benchPlayers = useMemo(() => benchRows.map((r) => r.player), [benchRows]);
  const captainId = useMemo(() => team?.players.find((x) => x.isCaptain)?.playerId ?? "", [team]);

  const logoRow = (
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
  );

  if (!team) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{logoRow}</div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-200">
          You do not have a fantasy team yet. Create one in the builder.
        </div>
      </div>
    );
  }

  const captain = team.players.find((p) => p.isCaptain);

  return (
    <div className="space-y-6">
      {!transferMarketOpen ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Transfer market is <span className="font-semibold">closed</span>. Roster changes are disabled until an admin
          reopens it. You can still change your captain from the team builder.
        </div>
      ) : null}

      <div className="flex flex-col items-stretch gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
        <div className="flex shrink-0 justify-center sm:justify-start">{logoRow}</div>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-2xl font-semibold text-white">{team.name}</h1>
          <p className="mt-1 text-sm text-slate-300">
            Captain:{" "}
            <span className="font-semibold text-[#EECC4E]">{captain ? captain.player.name : "Not set"}</span>
          </p>
          <div className="mt-2 text-xs uppercase tracking-wide text-slate-400">Total points</div>
          <div className="text-3xl font-bold tabular-nums text-white">{team.computedPoints}</div>
        </div>
      </div>

      {team.players.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-200">
          Your squad is empty. Add players in the builder.
        </div>
      ) : (
        <>
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#F8ECA7]">Pitch</h2>
            <Pitch players={starterPlayers} captainId={captainId} disabled hideEmptySlots />
          </div>

          <Bench subs={benchPlayers} disabled readOnly />
        </>
      )}
    </div>
  );
}
