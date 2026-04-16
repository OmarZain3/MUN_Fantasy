import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { ApiMatch, ApiPlayer } from "../types";

type Assignment = { id: string; userId: string; court: string };

export function CoordinatorPage() {
  const [court, setCourt] = useState("Court A");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [match, setMatch] = useState<ApiMatch | null>(null);
  const [players, setPlayers] = useState<ApiPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [minute, setMinute] = useState(1);
  const [scorerId, setScorerId] = useState("");
  const [assistId, setAssistId] = useState("");
  const [isOwnGoal, setIsOwnGoal] = useState(false);

  const [cardPlayerId, setCardPlayerId] = useState("");
  const [cardType, setCardType] = useState<"YELLOW" | "SECOND_YELLOW" | "RED">("YELLOW");
  const [cardMinute, setCardMinute] = useState(1);

  const [penPlayerId, setPenPlayerId] = useState("");
  const [penType, setPenType] = useState<"PENALTY_MISS" | "PENALTY_SAVE">("PENALTY_MISS");
  const [penMinute, setPenMinute] = useState(1);

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  const assignedCourts = useMemo(() => assignments.map((a) => a.court).join(", ") || "None", [assignments]);

  const courtOptions = useMemo(() => {
    const all = ["Court A", "Court B", "Court C", "Court D"];
    const fromAssign = assignments.map((a) => a.court);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of [...fromAssign, ...all]) {
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
    return out;
  }, [assignments]);

  async function reloadMatch() {
    setError(null);
    try {
      const [{ data: assigns }, { data: m }] = await Promise.all([
        api.get<Assignment[]>("/coordinator/assignment"),
        api.get<ApiMatch | null>(`/coordinator/match?court=${encodeURIComponent(court)}`),
      ]);
      setAssignments(assigns);
      setMatch(m);
      if (m) {
        setScoreA(m.scoreTeamA);
        setScoreB(m.scoreTeamB);
        const { data: squad } = await api.get<{ players: ApiPlayer[] }>(`/coordinator/match/${m.id}/players`);
        setPlayers(squad.players);
        if (!scorerId && squad.players[0]) setScorerId(squad.players[0]!.id);
        if (!cardPlayerId && squad.players[0]) setCardPlayerId(squad.players[0]!.id);
        if (!penPlayerId && squad.players[0]) setPenPlayerId(squad.players[0]!.id);
      } else {
        setPlayers([]);
      }
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed to load"));
    }
  }

  useEffect(() => {
    void reloadMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [court]);

  useEffect(() => {
    if (courtOptions.length && !courtOptions.includes(court)) {
      setCourt(courtOptions[0]!);
    }
  }, [court, courtOptions]);

  useEffect(() => {
    if (!match?.id) return;
    const socket = getSocket();
    socket.emit("join_match", match.id);
    const onUpdate = (payload: { match: ApiMatch }) => {
      if (payload?.match?.id === match.id) {
        setMatch(payload.match);
        setScoreA(payload.match.scoreTeamA);
        setScoreB(payload.match.scoreTeamB);
      }
    };
    socket.on("match_update", onUpdate);
    socket.on("goal_added", onUpdate);
    socket.on("card_added", onUpdate);
    return () => {
      socket.emit("leave_match", match.id);
      socket.off("match_update", onUpdate);
      socket.off("goal_added", onUpdate);
      socket.off("card_added", onUpdate);
    };
  }, [match?.id]);

  async function submitGoal() {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/coordinator/events/goal", {
        matchId: match.id,
        scorerId,
        assistId: assistId || null,
        minute,
        isOwnGoal,
      });
      await reloadMatch();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function submitCard() {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/coordinator/events/card", {
        matchId: match.id,
        playerId: cardPlayerId,
        minute: cardMinute,
        type: cardType,
      });
      await reloadMatch();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function submitPenalty() {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/coordinator/events/penalty", {
        matchId: match.id,
        playerId: penPlayerId,
        minute: penMinute,
        type: penType,
      });
      await reloadMatch();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  async function submitScore() {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/coordinator/score", { matchId: match.id, scoreTeamA: scoreA, scoreTeamB: scoreB });
      await reloadMatch();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Court coordinator</h1>
        <p className="mt-1 text-sm text-slate-300">
          Your assigned courts: <span className="font-semibold text-white">{assignedCourts}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-200">
          Court
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
            value={court}
            onChange={(e) => setCourt(e.target.value)}
          >
            {courtOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15" onClick={() => void reloadMatch()}>
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}

      {!match ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-200">
          No active match found for this court (UPCOMING/LIVE).
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-slate-300">Active match</div>
            <div className="mt-1 text-xl font-semibold text-white">
              {match.teamA} vs {match.teamB}
            </div>
            <div className="mt-2 text-sm text-slate-300">
              Status: <span className="font-semibold text-white">{match.status}</span> · Score{" "}
              <span className="font-semibold text-white">
                {match.scoreTeamA} – {match.scoreTeamB}
              </span>
            </div>
            {match.status !== "LIVE" ? (
              <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                Coordinator scoring actions require the match to be LIVE.
              </div>
            ) : null}
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">Add goal</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-200">
                Minute
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={minute}
                  min={0}
                  max={200}
                  onChange={(e) => setMinute(Number(e.target.value))}
                />
              </label>
              <label className="text-sm text-slate-200">
                Scorer
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={scorerId}
                  onChange={(e) => setScorerId(e.target.value)}
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.team}){p.isGK ? " · GK" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-200 md:col-span-2">
                Assist (optional)
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={assistId}
                  onChange={(e) => setAssistId(e.target.value)}
                >
                  <option value="">None</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.team})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-200 md:col-span-2">
                <input type="checkbox" checked={isOwnGoal} onChange={(e) => setIsOwnGoal(e.target.checked)} />
                Own goal
              </label>
            </div>
            <button
              type="button"
              disabled={busy || match.status !== "LIVE"}
              onClick={() => void submitGoal()}
              className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              Save goal
            </button>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">Add card</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="text-sm text-slate-200">
                Player
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={cardPlayerId}
                  onChange={(e) => setCardPlayerId(e.target.value)}
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-200">
                Type
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value as typeof cardType)}
                >
                  <option value="YELLOW">Yellow (-1)</option>
                  <option value="SECOND_YELLOW">Second yellow (-2)</option>
                  <option value="RED">Red (-3)</option>
                </select>
              </label>
              <label className="text-sm text-slate-200">
                Minute
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={cardMinute}
                  min={0}
                  max={200}
                  onChange={(e) => setCardMinute(Number(e.target.value))}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy || match.status !== "LIVE"}
              onClick={() => void submitCard()}
              className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
            >
              Save card
            </button>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">Penalty</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="text-sm text-slate-200">
                Player
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={penPlayerId}
                  onChange={(e) => setPenPlayerId(e.target.value)}
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-200">
                Type
                <select
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={penType}
                  onChange={(e) => setPenType(e.target.value as typeof penType)}
                >
                  <option value="PENALTY_MISS">Miss (-2)</option>
                  <option value="PENALTY_SAVE">Save (GK +5)</option>
                </select>
              </label>
              <label className="text-sm text-slate-200">
                Minute
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={penMinute}
                  min={0}
                  max={200}
                  onChange={(e) => setPenMinute(Number(e.target.value))}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy || match.status !== "LIVE"}
              onClick={() => void submitPenalty()}
              className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-60"
            >
              Save penalty event
            </button>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-semibold text-white">Update score (manual)</h2>
            <p className="mt-1 text-sm text-slate-300">This adjusts scoreboard totals and GK conceded penalties.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-200">
                {match.teamA} score
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={scoreA}
                  min={0}
                  onChange={(e) => setScoreA(Number(e.target.value))}
                />
              </label>
              <label className="text-sm text-slate-200">
                {match.teamB} score
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-white"
                  value={scoreB}
                  min={0}
                  onChange={(e) => setScoreB(Number(e.target.value))}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy || match.status !== "LIVE"}
              onClick={() => void submitScore()}
              className="mt-4 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-400/30 hover:bg-emerald-500/25 disabled:opacity-60"
            >
              Apply score update
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
