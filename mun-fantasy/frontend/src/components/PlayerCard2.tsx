import type { Player } from "../types";
import { GUC_MUN_PLAYER_CARD_SRC } from "../lib/gucLogos";

export function toImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return "";
  const u = imageUrl.trim();
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  return `${base}${u.startsWith("/") ? u : `/${u}`}`;
}

export interface PlayerCard2Props {
  player: Player | null;
  isCaptain?: boolean;
  isSub?: boolean;
  onSelect?: () => void;
  onCaptain?: () => void;
  selected?: boolean;
  disabled?: boolean;
  actionLabel?: string;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]![0]! : "";
  return (a + b).toUpperCase();
}

export default function PlayerCard2({
  player,
  isCaptain = false,
  isSub = false,
  onSelect,
  onCaptain,
  selected,
  disabled,
  actionLabel,
}: PlayerCard2Props) {
  const interactive = Boolean(onSelect) && !disabled;
  const imgSrc = player?.imageUrl ? toImageUrl(player.imageUrl) : "";

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
      onClick={disabled ? undefined : onSelect}
      data-component="PlayerCard2"
      className={[
        "relative flex h-40 w-28 flex-col items-center justify-center rounded-2xl border-2 p-2 text-white shadow-xl transition-transform duration-300",
        "bg-gradient-to-b from-[#083F5E] via-gray-900 to-[#083F5E]",
        selected ? "scale-105 border-[#EECC4E]" : "border-white/10 hover:border-[#EECC4E]",
        disabled ? "cursor-not-allowed opacity-40" : onSelect ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
    >
      {player ? (
        <>
          <img
            src={GUC_MUN_PLAYER_CARD_SRC}
            alt=""
            className="pointer-events-none absolute left-1 top-1 h-6 w-6 select-none object-contain sm:h-7 sm:w-7"
          />

          {isCaptain ? (
            <div className="absolute right-1 top-1">
              <span className="text-lg text-[#7dd3fc]">★</span>
            </div>
          ) : null}

          {imgSrc ? (
            <img
              src={imgSrc}
              alt={player.name}
              className="mb-1 h-16 w-16 rounded-full bg-[#083F5E]/30 object-cover"
            />
          ) : (
            <div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-[#083F5E]/30 text-sm font-bold text-[#7dd3fc]">
              {initials(player.name)}
            </div>
          )}

          <div className="mb-1 text-center text-xs font-semibold text-[#7dd3fc]">{player.name}</div>

          <div className="mt-auto flex w-full items-end justify-between gap-1 text-[10px] leading-tight text-white">
            <div className="min-w-0 flex-1 text-left">
              <div className="break-words">{player.team}</div>
              <div className="italic text-gray-400">{player.isGK ? "GK" : "Player"}</div>
            </div>
            <div className="shrink-0 text-right">
              <div>Round: {player.roundPoints ?? 0}</div>
              <div>Total: {player.totalPoints ?? 0}</div>
            </div>
          </div>

          {onCaptain && !isSub && !disabled ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCaptain();
              }}
              className="mt-2 rounded bg-[#EECC4E] px-2 py-1 text-[10px] font-semibold text-[#083F5E] transition hover:opacity-90"
            >
              {isCaptain ? "✓ Captain" : "Set C"}
            </button>
          ) : null}

          {actionLabel ? (
            <div className="mt-1 w-full truncate text-center text-[9px] font-medium text-gray-300">{actionLabel}</div>
          ) : null}
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center">
          <div className="text-4xl text-gray-400">+</div>
          <div className="mt-1 text-center text-xs text-gray-500">Add Player</div>
        </div>
      )}
    </div>
  );
}
