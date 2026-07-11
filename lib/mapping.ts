export type Mapping = {
  tournaments: {
    // value is the "Rxxxxxxx" id from the pgatour.com tournament URL
    [tournamentName: string]: { pgaId: string; suspended?: boolean };
  };
};

export const EMPTY_MAPPING: Mapping = { tournaments: {} };
