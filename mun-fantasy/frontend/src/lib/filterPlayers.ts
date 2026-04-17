import type { ApiPlayer } from "../types";

/** Team = "ALL" or exact `player.team`. Search matches player name or team (case-insensitive, Unicode-normalized). */
export function filterPlayersByTeamAndSearch(players: ApiPlayer[], team: string, search: string): ApiPlayer[] {
  const q = search.trim().toLowerCase().normalize("NFKC");
  const list = team === "ALL" ? players : players.filter((p) => p.team === team);
  if (!q) return list;
  return list.filter((p) => {
    const name = p.name.toLowerCase().normalize("NFKC");
    const t = p.team.toLowerCase().normalize("NFKC");
    return name.includes(q) || t.includes(q);
  });
}
