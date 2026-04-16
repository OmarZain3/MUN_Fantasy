export type ApiPlayer = {
  id: string;
  name: string;
  team: string;
  isGK: boolean;
  imageUrl: string | null;
  totalPoints: number;
  roundPoints: number;
};

/** Alias for player cards (matches fantasy “Player” shape; fields are camelCase from API). */
export type Player = ApiPlayer;

export type MatchEvent = {
  id: string;
  matchId: string;
  playerId: string;
  type: string;
  minute: number;
  player: ApiPlayer;
};

export type ApiMatch = {
  id: string;
  teamA: string;
  teamB: string;
  court: string;
  startTime: string;
  status: "UPCOMING" | "LIVE" | "FINISHED";
  scoreTeamA: number;
  scoreTeamB: number;
  events?: MatchEvent[];
};

export type FantasyTeamPlayer = {
  id: string;
  fantasyTeamId: string;
  playerId: string;
  isCaptain: boolean;
  isSub: boolean;
  player: ApiPlayer;
};

export type FantasyTeamResponse = {
  id: string;
  name: string;
  userId: string;
  players: FantasyTeamPlayer[];
  computedPoints: number;
};
