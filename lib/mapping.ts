export type Mapping = {
  tournaments: {
    [tournamentName: string]: { eventId: string };
  };
  players: {
    // key: exact player name as it appears in bets (e.g. "JT", "Chan Kim")
    [playerName: string]: { espnId: string; espnName: string };
  };
};

export const EMPTY_MAPPING: Mapping = { tournaments: {}, players: {} };
