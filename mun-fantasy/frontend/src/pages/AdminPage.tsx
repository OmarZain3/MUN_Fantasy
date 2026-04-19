import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import type { ApiMatch, ApiPlayer } from "../types";

type AdminUser = { id: string; email: string; isAdmin: boolean; createdAt: string };

type LeagueSettingsDto = { transferMarketOpen: boolean };

function localDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function localHour(iso: string): number {
  return new Date(iso).getHours();
}

function todayLocalDateKey(): string {
  const t = new Date();
  const y = t.getFullYear();
  const mo = String(t.getMonth() + 1).padStart(2, "0");
  const da = String(t.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

function OfflinePrepPanel({
  match,
  busy,
  setBusy,
  setError,
  reload,
}: {
  match: ApiMatch;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (msg: string | null) => void;
  reload: () => Promise<void>;
}) {
  const [players, setPlayers] = useState<ApiPlayer[] | null>(null);
  const [scoreA, setScoreA] = useState(match.scoreTeamA);
  const [scoreB, setScoreB] = useState(match.scoreTeamB);
  const [minute, setMinute] = useState(1);
  const [scorerId, setScorerId] = useState("");
  const [assistId, setAssistId] = useState("");
  const [ownGoal, setOwnGoal] = useState(false);

  useEffect(() => {
    setScoreA(match.scoreTeamA);
    setScoreB(match.scoreTeamB);
  }, [match.id, match.scoreTeamA, match.scoreTeamB]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ players: ApiPlayer[] }>(`/admin/matches/${match.id}/roster`);
        if (!cancelled) setPlayers(data.players);
      } catch {
        if (!cancelled) setPlayers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [match.id]);

  const scorer = players?.find((p) => p.id === scorerId);
  const assistOptions = useMemo(() => {
    if (!players || !scorer || ownGoal) return [];
    return players.filter((p) => p.team === scorer.team && p.id !== scorer.id);
  }, [players, scorer, ownGoal]);

  async function saveScore() {
    setError(null);
    setBusy(true);
    try {
      await api.patch(`/admin/matches/${match.id}/score`, {
        scoreTeamA: scoreA,
        scoreTeamB: scoreB,
      });
      await reload();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function addGoal() {
    setError(null);
    if (!scorerId) {
      setError("Pick a scorer");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/admin/matches/${match.id}/events/goal`, {
        scorerId,
        assistId: ownGoal ? null : assistId || null,
        minute,
        isOwnGoal: ownGoal,
      });
      setAssistId("");
      await reload();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function markFinishedFromUpcoming() {
    if (
      !window.confirm(
        "Mark this match FINISHED from UPCOMING? Use this after scores and events are entered offline. Clean-sheet bonuses will run.",
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.post(`/admin/matches/${match.id}/status`, { status: "FINISHED", finishFromUpcoming: true });
      await reload();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2 text-xs">
      <summary className="cursor-pointer select-none font-semibold text-amber-100/90">
        Prep without going LIVE (scores, goals — no live socket feed)
      </summary>
      <div className="mt-3 space-y-4 text-slate-200">
        <p className="text-slate-400">
          Works only while the match is <span className="font-semibold text-white">UPCOMING</span>. Player points
          update the same way as on the court; Socket.IO is not notified.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-slate-300">
            Score {match.teamA}
            <input
              type="number"
              min={0}
              className="mt-1 block w-20 rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
              value={scoreA}
              onChange={(e) => setScoreA(Number(e.target.value))}
            />
          </label>
          <label className="text-slate-300">
            Score {match.teamB}
            <input
              type="number"
              min={0}
              className="mt-1 block w-20 rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
              value={scoreB}
              onChange={(e) => setScoreB(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveScore()}
            className="rounded-lg bg-amber-500/25 px-3 py-1.5 font-semibold text-amber-50 ring-1 ring-amber-400/40 hover:bg-amber-500/35 disabled:opacity-40"
          >
            Save score
          </button>
        </div>
        <div className="grid gap-2 border-t border-white/10 pt-3 md:grid-cols-2">
          <label className="text-slate-300">
            Minute
            <input
              type="number"
              min={0}
              max={200}
              className="mt-1 block w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-slate-300">
            <input type="checkbox" checked={ownGoal} onChange={(e) => setOwnGoal(e.target.checked)} />
            Own goal
          </label>
          <label className="text-slate-300 md:col-span-2">
            Scorer
            <select
              className="mt-1 block w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
              value={scorerId}
              onChange={(e) => {
                setScorerId(e.target.value);
                setAssistId("");
              }}
            >
              <option value="">Select…</option>
              {(players ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.team})
                </option>
              ))}
            </select>
          </label>
          {!ownGoal ? (
            <label className="text-slate-300 md:col-span-2">
              Assist (optional)
              <select
                className="mt-1 block w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-white"
                value={assistId}
                onChange={(e) => setAssistId(e.target.value)}
              >
                <option value="">None</option>
                {assistOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            disabled={busy || !scorerId}
            onClick={() => void addGoal()}
            className="md:col-span-2 rounded-lg bg-white/10 px-3 py-2 font-semibold text-white hover:bg-white/15 disabled:opacity-40"
          >
            Record goal (+ points)
          </button>
        </div>
        {match.events && match.events.length > 0 ? (
          <div className="border-t border-white/10 pt-2">
            <div className="mb-1 font-semibold text-slate-400">Events on file</div>
            <ul className="max-h-28 list-inside list-disc overflow-y-auto text-slate-400">
              {match.events.map((ev) => (
                <li key={ev.id}>{`${ev.minute}' ${ev.type} — ${ev.player.name}`}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => void markFinishedFromUpcoming()}
          className="w-full rounded-lg bg-emerald-600/30 px-3 py-2 font-semibold text-emerald-50 ring-1 ring-emerald-400/40 hover:bg-emerald-600/45 disabled:opacity-40"
        >
          Mark FINISHED (skip LIVE)
        </button>
      </div>
    </details>
  );
}

export function AdminPage() {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [transferMarketOpen, setTransferMarketOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [teams, setTeams] = useState<string[]>([]);
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [court, setCourt] = useState("Court A");
  const [startTime, setStartTime] = useState(() => new Date(Date.now() + 3600_000).toISOString().slice(0, 16));

  const [assignUserId, setAssignUserId] = useState("");
  const [assignCourt, setAssignCourt] = useState("Court A");
  const [success, setSuccess] = useState<string | null>(null);

  const [matchDay, setMatchDay] = useState("");
  const [matchHourFrom, setMatchHourFrom] = useState("");
  const [matchHourTo, setMatchHourTo] = useState("");
  const [matchCourtFilter, setMatchCourtFilter] = useState<"ALL" | "Court A" | "Court B" | "Court C" | "Court D">(
    "ALL",
  );
  const [matchStatusFilter, setMatchStatusFilter] = useState<"ALL" | "UPCOMING" | "LIVE" | "FINISHED">("ALL");

  const teamBOptions = useMemo(() => teams.filter((t) => t !== teamA), [teams, teamA]);
  const canCreateMatch = teams.length >= 2 && teamBOptions.length > 0 && Boolean(teamA) && Boolean(teamB);

  async function reload() {
    const [{ data: teamList }, { data: ms }, { data: us }, { data: st }] = await Promise.all([
      api.get<string[]>("/admin/teams"),
      api.get<ApiMatch[]>("/admin/matches"),
      api.get<AdminUser[]>("/admin/users"),
      api.get<LeagueSettingsDto>("/admin/settings"),
    ]);
    setTeams(teamList);
    setMatches(ms);
    setUsers(us);
    setTransferMarketOpen(st.transferMarketOpen);
  }

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch {
        if (!cancelled) setError("Failed to load admin data (are you an admin?)");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (teams.length === 0) return;
    const nextA = teams.includes(teamA) ? teamA : teams[0]!;
    const candidates = teams.filter((t) => t !== nextA);
    const nextB =
      candidates.length > 0 && teams.includes(teamB) && teamB !== nextA ? teamB : (candidates[0] ?? "");
    if (nextA !== teamA) setTeamA(nextA);
    if (candidates.length > 0 && nextB !== teamB) setTeamB(nextB);
  }, [teams, teamA, teamB]);

  const userOptions = useMemo(() => users.filter((u) => !u.isAdmin), [users]);

  const filteredMatches = useMemo(() => {
    let list = [...matches].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    if (matchCourtFilter !== "ALL") list = list.filter((m) => m.court === matchCourtFilter);
    if (matchStatusFilter !== "ALL") list = list.filter((m) => m.status === matchStatusFilter);
    if (matchDay) {
      list = list.filter((m) => localDateKey(m.startTime) === matchDay);
      if (matchHourFrom !== "") {
        const hf = Number(matchHourFrom);
        if (!Number.isNaN(hf)) list = list.filter((m) => localHour(m.startTime) >= hf);
      }
      if (matchHourTo !== "") {
        const ht = Number(matchHourTo);
        if (!Number.isNaN(ht)) list = list.filter((m) => localHour(m.startTime) <= ht);
      }
    }
    return list;
  }, [matches, matchCourtFilter, matchStatusFilter, matchDay, matchHourFrom, matchHourTo]);

  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i)), []);

  if (!isAdmin) return <Navigate to="/market" replace />;

  async function createMatch() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await api.post("/admin/matches", {
        teamA,
        teamB,
        court,
        startTime: new Date(startTime).toISOString(),
      });
      await reload();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "UPCOMING" | "LIVE" | "FINISHED") {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/admin/matches/${id}/status`, { status });
      await reload();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function submitCourtAssignment() {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await api.post("/admin/courts/assign", { userId: assignUserId, court: assignCourt });
      await reload();
      setSuccess("Court assignment saved.");
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function patchTransferMarket(open: boolean) {
    setError(null);
    setBusy(true);
    try {
      await api.patch("/admin/settings", { transferMarketOpen: open });
      await reload();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Admin dashboard</h1>
          <p className="mt-1 text-sm text-slate-300">Create matches, assign courts, and monitor status.</p>
        </div>
        <Link className="text-sm text-emerald-300 hover:underline" to="/live">
          View live hub
        </Link>
      </div>

      {error ? <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
      {success ? <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">{success}</div> : null}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white">Transfer market</h2>
        <p className="mt-1 text-sm text-slate-300">
          When <span className="font-semibold text-amber-200">off</span>, players cannot add, remove, or bench/promote
          squad members (captain changes still allowed).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="text-sm text-slate-200">Status:</span>
          <span className={transferMarketOpen ? "font-semibold text-emerald-300" : "font-semibold text-amber-200"}>
            {transferMarketOpen ? "OPEN" : "CLOSED"}
          </span>
          <button
            type="button"
            disabled={busy || transferMarketOpen}
            onClick={() => void patchTransferMarket(true)}
            className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-400/40 hover:bg-emerald-500/30 disabled:opacity-40"
          >
            Turn ON
          </button>
          <button
            type="button"
            disabled={busy || !transferMarketOpen}
            onClick={() => void patchTransferMarket(false)}
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 ring-1 ring-amber-400/40 hover:bg-amber-500/30 disabled:opacity-40"
          >
            Turn OFF
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white">Create match</h2>
        {teams.length < 2 ? (
          <p className="mt-2 text-sm text-amber-200/90">
            The player pool needs at least two teams. Load players with the database seed step on deploy (see
            production README).
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-200">
            Team A
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={teamA}
              onChange={(e) => setTeamA(e.target.value)}
            >
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-200">
            Team B
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white disabled:opacity-50"
              value={teamBOptions.includes(teamB) ? teamB : teamBOptions[0] ?? ""}
              disabled={teamBOptions.length === 0}
              onChange={(e) => setTeamB(e.target.value)}
            >
              {teamBOptions.length === 0 ? (
                <option value="">Add another team to the pool</option>
              ) : (
                teamBOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="text-sm text-slate-200">
            Court
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={court}
              onChange={(e) => setCourt(e.target.value)}
            >
              {["Court A", "Court B", "Court C", "Court D"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-200">
            Start time (local)
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !canCreateMatch}
          onClick={createMatch}
          className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          Create
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white">Assign court coordinator</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-200">
            User
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
            >
              <option value="">Select user…</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-200">
            Court
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
              value={assignCourt}
              onChange={(e) => setAssignCourt(e.target.value)}
            >
              {["Court A", "Court B", "Court C", "Court D"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !assignUserId}
          onClick={() => void submitCourtAssignment()}
          className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
        >
          Assign
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white">Matches</h2>
        <p className="mt-1 text-sm text-slate-400">
          Filter by scheduled day (your local time), optional hour window that day, court, and status.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-200">
            Day
            <input
              type="date"
              className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              value={matchDay}
              onChange={(e) => setMatchDay(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
            onClick={() => setMatchDay(todayLocalDateKey())}
          >
            Today
          </button>
          <button
            type="button"
            className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
            onClick={() => {
              setMatchDay("");
              setMatchHourFrom("");
              setMatchHourTo("");
              setMatchCourtFilter("ALL");
              setMatchStatusFilter("ALL");
            }}
          >
            Clear filters
          </button>
          <label className={`text-sm text-slate-200 ${matchDay ? "" : "opacity-50"}`}>
            From hour
            <select
              className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white disabled:opacity-50"
              value={matchHourFrom}
              disabled={!matchDay}
              onChange={(e) => setMatchHourFrom(e.target.value)}
            >
              <option value="">Any</option>
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </label>
          <label className={`text-sm text-slate-200 ${matchDay ? "" : "opacity-50"}`}>
            To hour
            <select
              className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white disabled:opacity-50"
              value={matchHourTo}
              disabled={!matchDay}
              onChange={(e) => setMatchHourTo(e.target.value)}
            >
              <option value="">Any</option>
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {h}:59
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-200">
            Court
            <select
              className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              value={matchCourtFilter}
              onChange={(e) => setMatchCourtFilter(e.target.value as typeof matchCourtFilter)}
            >
              <option value="ALL">All courts</option>
              {["Court A", "Court B", "Court C", "Court D"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-200">
            Status
            <select
              className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              value={matchStatusFilter}
              onChange={(e) => setMatchStatusFilter(e.target.value as typeof matchStatusFilter)}
            >
              <option value="ALL">All</option>
              <option value="UPCOMING">UPCOMING</option>
              <option value="LIVE">LIVE</option>
              <option value="FINISHED">FINISHED</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Showing {filteredMatches.length} of {matches.length} matches
        </p>
        <div className="mt-3 space-y-2">
          {filteredMatches.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 rounded-xl bg-black/20 p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-white">
                  {m.teamA} vs {m.teamB}
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(m.startTime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                  {m.status} · {m.court} · Score {m.scoreTeamA}-{m.scoreTeamB}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || m.status !== "UPCOMING"}
                  className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-400/30 disabled:opacity-40"
                  onClick={() => setStatus(m.id, "LIVE")}
                >
                  Start (LIVE)
                </button>
                <button
                  type="button"
                  disabled={busy || m.status !== "LIVE"}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  onClick={() => setStatus(m.id, "FINISHED")}
                >
                  Finish
                </button>
              </div>
              {m.status === "UPCOMING" ? (
                <OfflinePrepPanel match={m} busy={busy} setBusy={setBusy} setError={setError} reload={reload} />
              ) : null}
            </div>
          ))}
          {filteredMatches.length === 0 && matches.length > 0 ? (
            <p className="text-sm text-slate-400">No matches match the current filters.</p>
          ) : null}
          {matches.length === 0 ? <p className="text-sm text-slate-400">No matches yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
