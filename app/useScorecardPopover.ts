"use client";

import { useState } from "react";

type ScorecardState = { loading: boolean; scorecard: any; position?: string | null; totalToPar?: number | null; message?: string } | null;

export function useScorecardPopover() {
  const [state, setState] = useState<ScorecardState>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openTournament, setOpenTournament] = useState<string>("");
  const [openRound, setOpenRound] = useState<string>("");

  function open(key: string, tournament: string, round: string, player: string) {
    if (openKey === key) {
      setOpenKey(null);
      setState(null);
      return;
    }
    setOpenKey(key);
    setOpenTournament(tournament);
    setOpenRound(round);
    setState({ loading: true, scorecard: null });
    fetch(`/api/scorecard?tournament=${encodeURIComponent(tournament)}&round=${encodeURIComponent(round)}&player=${encodeURIComponent(player)}`)
      .then((r) => r.json())
      .then((d) => {
        setState({
          loading: false,
          scorecard: d.scorecard || null,
          position: d.position ?? null,
          totalToPar: d.totalToPar ?? null,
          message: d.message || d.error,
        });
      })
      .catch(() => setState({ loading: false, scorecard: null, message: "Couldn't load scorecard." }));
  }

  function close() {
    setOpenKey(null);
    setState(null);
  }

  return { openKey, state, open, close, openTournament, openRound };
}
