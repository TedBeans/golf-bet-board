"use client";

import { useState } from "react";
import { fetchFresh } from "../lib/fetchFresh";

type ScorecardState = {
  loading: boolean;
  scorecard: any;
  position?: string | null;
  totalToPar?: number | null;
  message?: string;
  summary?: {
    thru: number; birdies: number; eagles: number; pars: number; bogeys: number;
    doubleBogeys: number; birdiesOrBetter: number; bogeysOrWorse: number;
    gir: string | null; fairways: string | null;
  } | null;
} | null;

export function useScorecardPopover() {
  const [state, setState] = useState<ScorecardState>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openTournament, setOpenTournament] = useState<string>("");
  const [openRound, setOpenRound] = useState<string>("");
  const [openPlayer, setOpenPlayer] = useState<string>("");

  function open(key: string, tournament: string, round: string, player: string) {
    if (openKey === key) {
      setOpenKey(null);
      setState(null);
      return;
    }
    setOpenKey(key);
    setOpenTournament(tournament);
    setOpenRound(round);
    setOpenPlayer(player);
    setState({ loading: true, scorecard: null });
    fetchFresh(`/api/scorecard?tournament=${encodeURIComponent(tournament)}&round=${encodeURIComponent(round)}&player=${encodeURIComponent(player)}`)
      .then((r) => r.json())
      .then((d) => {
        setState({
          loading: false,
          scorecard: d.scorecard || null,
          position: d.position ?? null,
          totalToPar: d.totalToPar ?? null,
          message: d.message || d.error,
          summary: d.summary ?? null,
        });
      })
      .catch(() => setState({ loading: false, scorecard: null, message: "Couldn't load scorecard." }));
  }

  function close() {
    setOpenKey(null);
    setState(null);
  }

  return { openKey, state, open, close, openTournament, openRound, openPlayer };
}
