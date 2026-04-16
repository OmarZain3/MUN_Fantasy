import type { Player } from "@/types";
import PlayerCard2 from "./PlayerCard2";

const BENCH_SIZE = 2;

export interface BenchProps {
  subs: Player[];
  onAdd?: () => void;
  selectedSubId?: string | null;
  onSelectSub?: (playerId: string) => void;
  disabled?: boolean;
  disableAdd?: boolean;
  onRemoveSub?: (playerId: string) => void;
  onPromoteSub?: (playerId: string) => void;
  /** Empty slots show placeholders instead of “Add”. */
  readOnly?: boolean;
  /** Transfer market closed: no add / promote / remove. */
  rosterLocked?: boolean;
}

export function Bench({
  subs,
  onAdd,
  selectedSubId = null,
  onSelectSub,
  disabled = false,
  disableAdd = false,
  onRemoveSub,
  onPromoteSub,
  readOnly = false,
  rosterLocked = false,
}: BenchProps) {
  const slots: (Player | null)[] = [...subs];
  while (slots.length < BENCH_SIZE) slots.push(null);

  return (
    <div className="rounded-xl border-2 border-[#083F5E]/50 bg-[#083F5E]/20 p-3">
      <p className="mb-2 text-center text-sm font-bold uppercase tracking-wide text-[#F8ECA7]">Bench</p>
      <div className="flex flex-wrap justify-center gap-3">
        {slots.slice(0, BENCH_SIZE).map((player, i) =>
          player ? (
            <div key={player.id} className="flex flex-col items-center gap-1">
              <PlayerCard2
                player={player}
                isSub
                selected={selectedSubId === player.id}
                onSelect={onSelectSub && !disabled && !rosterLocked ? () => onSelectSub(player.id) : undefined}
                disabled={disabled}
              />
              {(onRemoveSub || onPromoteSub) && !disabled && !rosterLocked ? (
                <div className="flex max-w-[7rem] flex-col gap-1">
                  {onPromoteSub ? (
                    <button
                      type="button"
                      onClick={() => onPromoteSub(player.id)}
                      className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/15"
                    >
                      Promote
                    </button>
                  ) : null}
                  {onRemoveSub ? (
                    <button
                      type="button"
                      onClick={() => onRemoveSub(player.id)}
                      className="rounded-lg bg-red-500/15 px-2 py-1 text-[10px] font-semibold text-red-100 ring-1 ring-red-400/30 hover:bg-red-500/25"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : readOnly ? (
            <div
              key={`empty-${i}`}
              className="h-40 w-28 rounded-2xl border border-white/15 bg-black/15"
              aria-hidden
            />
          ) : (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={onAdd}
              disabled={disableAdd || rosterLocked || !onAdd}
              className={`flex h-40 w-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed transition ${
                disableAdd || rosterLocked || !onAdd
                  ? "cursor-not-allowed border-[#EECC4E]/30 bg-[#083F5E]/10 opacity-50"
                  : "border-[#EECC4E]/60 bg-[#083F5E]/30 hover:border-[#EECC4E] hover:bg-[#083F5E]/50"
              }`}
            >
              <span className="text-3xl font-light text-[#EECC4E]">+</span>
              <span className="text-xs font-medium text-[#F8ECA7]">Add</span>
            </button>
          ),
        )}
      </div>
    </div>
  );
}
