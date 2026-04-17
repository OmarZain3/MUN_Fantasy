import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import type { ApiMatch } from "../types";

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
