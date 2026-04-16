import type { Player } from "@/types";
import PlayerCard2 from "./PlayerCard2";

/** Formation: 2-2-1 (FPL style, your goal at bottom). Order: [fwd1, fwd2, mid1, mid2, gk]. */
export interface PitchProps {
  players: Player[];
  captainId: string;
  onSlotAdd?: () => void;
  onSetCaptain?: (playerId: string) => void;
  disabled?: boolean;
  /** When true, empty formation slots render a quiet placeholder instead of “Add”. */
  hideEmptySlots?: boolean;
  onBenchStarter?: (playerId: string) => void;
  onRemoveStarter?: (playerId: string) => void;
  /** When false, “Bench” is hidden (bench full). */
  canBenchStarter?: boolean;
  /** When true, empty slots and bench/remove controls are disabled (transfer window closed). */
  rosterLocked?: boolean;
}

export function orderMainPlayers(players: Player[]): (Player | null)[] {
  const gk = players.find((p) => p.isGK) ?? null;
  const outfield = players.filter((p) => !p.isGK).sort((a, b) => a.name.localeCompare(b.name));
  const slots: (Player | null)[] = [null, null, null, null, gk];
  let idx = 0;
  for (const p of outfield) {
    if (idx < 4) slots[idx++] = p;
  }
  return slots;
}

export function Pitch({
  players,
  captainId,
  onSlotAdd,
  onSetCaptain,
  disabled = false,
  hideEmptySlots = false,
  onBenchStarter,
  onRemoveStarter,
  canBenchStarter = true,
  rosterLocked = false,
}: PitchProps) {
  const ordered = orderMainPlayers(players);
  const [fwd1, fwd2, mid1, mid2, gk] = ordered;

  function slot(p: Player | null, key: string) {
    const showRow =
      Boolean(p) &&
      !hideEmptySlots &&
      (onBenchStarter || onRemoveStarter) &&
      !disabled &&
      !rosterLocked;

    return (
      <div className="flex flex-col items-center justify-center" key={key}>
        {p ? (
          <PlayerCard2
            player={p}
            isCaptain={p.id === captainId}
            onCaptain={onSetCaptain ? () => onSetCaptain(p.id) : undefined}
            disabled={disabled}
          />
        ) : hideEmptySlots ? (
          <div className="h-40 w-28 rounded-2xl border border-white/15 bg-black/15" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={onSlotAdd}
            disabled={disabled || rosterLocked || !onSlotAdd}
            className="flex h-40 w-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#EECC4E]/60 bg-[#083F5E]/30 transition hover:border-[#EECC4E] hover:bg-[#083F5E]/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="text-3xl font-light text-[#EECC4E]">+</span>
            <span className="text-xs font-medium text-[#F8ECA7]">Add</span>
          </button>
        )}
        {showRow && p ? (
          <div className="mt-1 flex max-w-[7rem] flex-col gap-1">
            {onBenchStarter && canBenchStarter ? (
              <button
                type="button"
                onClick={() => onBenchStarter(p.id)}
                className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/15"
              >
                Bench
              </button>
            ) : null}
            {onRemoveStarter ? (
              <button
                type="button"
                onClick={() => onRemoveStarter(p.id)}
                className="rounded-lg bg-red-500/15 px-2 py-1 text-[10px] font-semibold text-red-100 ring-1 ring-red-400/30 hover:bg-red-500/25"
              >
                Remove
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative z-0 w-full overflow-hidden rounded-2xl border-4 border-[#083F5E] bg-gradient-to-b from-[#1b4332] via-[#2d6a4f] to-[#2d6a4f] shadow-xl">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(0,0,0,0.08) 24px, rgba(0,0,0,0.08) 48px)",
        }}
      />
      <div className="absolute inset-0 rounded-[14px] border-[3px] border-white/70" />
      <div className="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-white/60" />
      <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/50" />

      <div className="relative grid grid-cols-3 gap-2 p-4 pb-5 pt-5">
        <div className="col-span-3 flex justify-center gap-4">
          {slot(fwd1, "fwd1")}
          {slot(fwd2, "fwd2")}
        </div>
        <div className="col-span-3 flex justify-center gap-4">
          {slot(mid1, "mid1")}
          {slot(mid2, "mid2")}
        </div>
        <div className="col-span-3 flex justify-center">{slot(gk, "gk")}</div>
      </div>
    </div>
  );
}
