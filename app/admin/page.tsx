"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bet } from "../../lib/seed";
import { Mapping, EMPTY_MAPPING } from "../../lib/mapping";
import { parseCombinedText, ParseResult } from "../../lib/parseCombined";
import { defaultUnitsToWinOne } from "../../lib/units";
import { nowInCentral } from "../../lib/centralTime";
import { Parlay, ParlayLegRef } from "../../lib/parlay";
import { Settings, DEFAULT_SETTINGS } from "../../lib/settings";
import GolfFlagIcon from "../GolfFlagIcon";

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [lockError, setLockError] = useState("");
  const [bets, setBets] = useState<Bet[]>([]);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [saveMsg, setSaveMsg] = useState("");

  const [importText, setImportText] = useState("");
  const [betsDate, setBetsDate] = useState(() => nowInCentral().dateStr);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [importMsg, setImportMsg] = useState("");

  const [winnerTournament, setWinnerTournament] = useState("");
  const [winnerSide, setWinnerSide] = useState<"Under" | "Over">("Under");
  const [winnerStrokes, setWinnerStrokes] = useState("");
  const [winnerCoursePar, setWinnerCoursePar] = useState("288");
  const [winnerOdds, setWinnerOdds] = useState("");
  const [winnerWagerDollars, setWinnerWagerDollars] = useState("");
  const [winnerDate, setWinnerDate] = useState(() => nowInCentral().dateStr);
  const [winnerMsg, setWinnerMsg] = useState("");

  const [forceMsg, setForceMsg] = useState("");
  const [tab, setTab] = useState<"bets" | "tournaments" | "parlays">("bets");
  const [newTournName, setNewTournName] = useState("");
  const [backupMsg, setBackupMsg] = useState("");

  const [archive, setArchive] = useState<Bet[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [liveParlays, setLiveParlays] = useState<Parlay[]>([]);
  const [parlayArchiveList, setParlayArchiveList] = useState<Parlay[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [selectedLegIds, setSelectedLegIds] = useState<Set<string>>(new Set());
  const [parlayLabel, setParlayLabel] = useState("");
  const [parlayOdds, setParlayOdds] = useState("");
  const [parlayWagerDollars, setParlayWagerDollars] = useState("");
  const [parlayDate, setParlayDate] = useState(() => nowInCentral().dateStr);
  const [parlayMsg, setParlayMsg] = useState("");

  function downloadBackup() {
    setBackupMsg("Preparing backup…");
    Promise.all([
      fetch("/api/bets").then((r) => r.json()),
      fetch("/api/archive").then((r) => r.json()),
      fetch("/api/mapping").then((r) => r.json()),
    ]).then(([betsData, archiveData, mappingData]) => {
      const payload = {
        exportedAt: new Date().toISOString(),
        bets: betsData.bets || [],
        archive: archiveData.archive || [],
        mapping: mappingData.mapping || {},
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `golf-bet-board-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupMsg("Downloaded.");
      setTimeout(() => setBackupMsg(""), 3000);
    }).catch(() => setBackupMsg("Backup failed - try again."));
  }

  useEffect(() => {
    const stored = sessionStorage.getItem("bb_passcode");
    if (stored) {
      setPasscode(stored);
      setUnlocked(true);
    }
    fetch("/api/bets").then((r) => r.json()).then((d) => setBets(d.bets || []));
    fetch("/api/mapping").then((r) => r.json()).then((d) => setMapping(d.mapping || EMPTY_MAPPING));
    fetch("/api/archive").then((r) => r.json()).then((d) => setArchive(d.archive || []));
    fetch("/api/settings").then((r) => r.json()).then((d) => setSettings(d.settings || DEFAULT_SETTINGS));
    fetch("/api/parlays").then((r) => r.json()).then((d) => setLiveParlays(d.parlays || []));
    fetch("/api/parlay-archive").then((r) => r.json()).then((d) => setParlayArchiveList(d.archive || []));
  }, []);

  function tryUnlock() {
    setLockError("");
    fetch("/api/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, mapping }),
    }).then((r) => {
      if (r.ok) {
        setUnlocked(true);
        sessionStorage.setItem("bb_passcode", passcode);
      } else {
        setLockError("Wrong passcode");
      }
    });
  }

  const tournaments = Array.from(new Set([...Object.keys(mapping.tournaments), ...bets.map((b) => b.t)]));

  function addTournament() {
    const name = newTournName.trim();
    if (!name || mapping.tournaments[name]) return;
    setMapping((m) => ({ ...m, tournaments: { ...m.tournaments, [name]: { pgaId: "" } } }));
    setNewTournName("");
  }

  function removeTournament(name: string) {
    setMapping((m) => {
      const next = { ...m.tournaments };
      delete next[name];
      return { ...m, tournaments: next };
    });
  }

  const roundGroups = Array.from(new Set(bets.map((b) => `${b.t}|||${b.r}`))).map((key) => {
    const [t, r] = key.split("|||");
    const groupBets = bets.filter((b) => b.t === t && b.r === r);
    const pending = groupBets.filter((b) => b.status === "pending" || b.status === "live").length;
    return { t, r, total: groupBets.length, pending, decided: groupBets.length - pending };
  });

  const archiveGroups = Array.from(new Set(archive.map((b) => `${b.t}|||${b.r}`))).map((key) => {
    const [t, r] = key.split("|||");
    const groupBets = archive.filter((b) => b.t === t && b.r === r);
    const wins = groupBets.filter((b) => b.status === "hit").length;
    const losses = groupBets.filter((b) => b.status === "miss").length;
    const currentDate = groupBets[0]?.loadedDate || "";
    return { t, r, total: groupBets.length, wins, losses, currentDate };
  });

  const [dateFixEdits, setDateFixEdits] = useState<Record<string, string>>({});
  const [expandedArchiveTourn, setExpandedArchiveTourn] = useState<string | null>(null);

  function restoreArchiveGroup(tourn: string, round: string) {
    fetch("/api/archive", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, tournament: tourn, round }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          const restored = archive.filter((b) => b.t === tourn && b.r === round);
          setArchive((prev) => prev.filter((b) => !(b.t === tourn && b.r === round)));
          setBets((prev) => [...prev, ...restored.map(({ archivedAt, ...rest }) => rest as Bet)]);
          setForceMsg(`Restored ${d.restored} bet(s) to the live board.`);
        } else {
          setForceMsg("Failed - check passcode.");
        }
        setTimeout(() => setForceMsg(""), 4000);
      });
  }

  function fixArchiveGroupDate(tourn: string, round: string, newDate: string) {
    if (!newDate) return;
    fetch("/api/archive", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, tournament: tourn, round, fixDate: newDate }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setArchive((prev) => prev.map((b) => (b.t === tourn && b.r === round ? { ...b, loadedDate: newDate } : b)));
          setForceMsg(`Updated ${d.updated} bet(s) to ${newDate}.`);
        } else {
          setForceMsg("Failed - check passcode.");
        }
        setTimeout(() => setForceMsg(""), 4000);
      });
  }

  function deleteArchiveGroup(tourn: string, round: string) {
    if (!confirm(`Permanently remove ${tourn} · ${round} from the recap? This can't be undone.`)) return;
    fetch("/api/archive", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, tournament: tourn, round }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setArchive((prev) => prev.filter((b) => !(b.t === tourn && b.r === round)));
          setForceMsg(`Removed ${d.removed} bet(s) from the recap.`);
        } else {
          setForceMsg("Failed - check passcode.");
        }
        setTimeout(() => setForceMsg(""), 4000);
      });
  }

  function saveSettings() {
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, settings }),
    }).then((r) => {
      setSettingsMsg(r.ok ? "Saved." : "Save failed - check passcode.");
      setTimeout(() => setSettingsMsg(""), 3000);
    });
  }

  // Every bet currently visible for parlay-building, whether it's still
  // live on the board or already resolved and archived - a leg from an
  // already-decided round (like the ISCO example) still needs to show up
  // here so past-dated parlays can reference it.
  const pickableBets = [...bets, ...archive];

  function toggleLeg(betId: string) {
    setSelectedLegIds((prev) => {
      const next = new Set(prev);
      if (next.has(betId)) next.delete(betId);
      else next.add(betId);
      return next;
    });
  }

  function startRename(p: Parlay) {
    setRenamingId(p.id);
    setRenameValue(p.label);
  }

  function saveRename(parlayId: string) {
    const label = renameValue.trim();
    if (!label) return;
    fetch("/api/parlays", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, parlayId, label }),
    }).then((r) => r.json()).then((d) => {
      if (d.ok) {
        setLiveParlays((prev) => prev.map((p) => (p.id === parlayId ? { ...p, label } : p)));
        setParlayArchiveList((prev) => prev.map((p) => (p.id === parlayId ? { ...p, label } : p)));
      } else {
        setParlayMsg(d.error || "Rename failed.");
        setTimeout(() => setParlayMsg(""), 3000);
      }
      setRenamingId(null);
    });
  }

  function submitParlay() {
    const dollars = parseFloat(parlayWagerDollars);
    if (!parlayOdds.trim() || isNaN(dollars) || selectedLegIds.size === 0) {
      setParlayMsg("Add odds, a wager amount, and at least one leg first.");
      return;
    }
    const legs: ParlayLegRef[] = pickableBets
      .filter((b) => selectedLegIds.has(b.id))
      .map((b) => ({ betId: b.id, player: b.player, bet: b.bet, tournament: b.t, round: b.r }));

    const parlay: Parlay = {
      id: "parlay_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      label: parlayLabel.trim() || `${legs.length} Pick Parlay`,
      legs,
      oddsPrice: parlayOdds.trim(),
      wagerDollars: dollars,
      wagerUnits: Math.round((dollars / (settings.unitSizeDollars || 50)) * 100) / 100,
      status: "pending",
      loadedDate: parlayDate,
    };

    fetch("/api/parlays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, parlay }),
    }).then((r) => r.json()).then((d) => {
      if (d.ok) {
        setLiveParlays((prev) => [...prev, d.parlay]);
        setParlayMsg(`Added "${parlay.label}."`);
        setSelectedLegIds(new Set());
        setParlayLabel("");
        setParlayOdds("");
        setParlayWagerDollars("");
        setParlayDate(nowInCentral().dateStr);
      } else {
        setParlayMsg(d.error || "Failed to save.");
      }
      setTimeout(() => setParlayMsg(""), 4000);
    });
  }

  function forceArchive(tourn: string, round: string) {
    fetch("/api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, tournament: tourn, round }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setBets((prev) => prev.filter((b) => !(b.t === tourn && b.r === round)));
          setForceMsg(`Archived ${d.archived} bet(s) from ${tourn} ${round}.`);
        } else {
          setForceMsg("Failed - check passcode.");
        }
        setTimeout(() => setForceMsg(""), 4000);
      });
  }

  function saveMapping() {
    fetch("/api/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, mapping }),
    }).then((r) => {
      setSaveMsg(r.ok ? "Saved." : "Save failed - check passcode.");
      setTimeout(() => setSaveMsg(""), 3000);
    });
  }

  function submitWinnerBet() {
    const strokes = parseFloat(winnerStrokes);
    const coursePar = parseFloat(winnerCoursePar);
    const dollars = parseFloat(winnerWagerDollars);
    if (!winnerTournament || isNaN(strokes) || isNaN(coursePar) || !winnerOdds.trim() || isNaN(dollars)) {
      setWinnerMsg("Fill in the tournament, strokes, course par, odds, and wager first.");
      return;
    }
    const targetToPar = Math.round((strokes - coursePar) * 2) / 2; // keep .5 lines exact
    const targetDisplay = targetToPar === 0 ? "E" : targetToPar > 0 ? `+${targetToPar}` : `${targetToPar}`;
    const phrase = winnerSide === "Under" ? `Winning score ${targetDisplay} or better` : `Winning score ${targetDisplay} or worse`;

    const newBet: Bet = {
      id: "b_winner_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      t: winnerTournament,
      r: "Tournament Winner",
      time: "",
      player: "Field",
      bet: phrase,
      stat: null,
      thru: null,
      status: "pending",
      autoEnabled: true,
      auto: null,
      oddsLine: `${winnerSide} ${winnerStrokes}`,
      oddsPrice: winnerOdds.trim(),
      oddsUnits: String(Math.round((dollars / (settings.unitSizeDollars || 50)) * 100) / 100),
      loadedDate: winnerDate,
    };

    fetch("/api/bets")
      .then((r) => r.json())
      .then((d) => {
        const current: Bet[] = d.bets || [];
        const merged = [...current, newBet];
        return fetch("/api/bets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode, bets: merged }),
        }).then((r) => ({ r, merged }));
      })
      .then(({ r, merged }) => {
        if (r.ok) {
          setBets(merged);
          setWinnerMsg(`Added. Tracks the current tournament leader until you settle it by hand.`);
          setWinnerStrokes("");
          setWinnerOdds("");
          setWinnerWagerDollars("");
          setWinnerDate(nowInCentral().dateStr);
        } else {
          setWinnerMsg("Failed to save - check passcode.");
        }
        setTimeout(() => setWinnerMsg(""), 5000);
      });
  }

  function previewImport() {
    setImportMsg("");
    const roundParLookup = (t: string) => mapping.tournaments[t]?.roundPar;
    setPreview(parseCombinedText(importText, betsDate, roundParLookup));
  }

  function confirmImport() {
    if (!preview || preview.bets.length === 0) return;

    const liveIds = new Set(bets.map((b) => b.id));
    fetch("/api/bets")
      .then((r) => r.json())
      .then((d) => {
        const current: Bet[] = d.bets || [];
        const merged = [...current, ...preview.bets];
        return fetch("/api/bets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode, bets: merged }),
        }).then((r) => ({ r, merged }));
      })
      .then(({ r, merged }) => {
        if (r.ok) {
          setImportMsg(`Added ${preview.bets.length} bet(s) with odds attached. Anything still unresolved from before stays on the board too.`);
          setBets(merged);
          setPreview(null);
          setImportText("");
          setBetsDate(nowInCentral().dateStr);
        } else {
          setImportMsg("Failed to save - check passcode.");
        }
      });
  }

  function backfillMissingUnits() {
    const liveFixed = bets.map((b) =>
      b.oddsPrice && !b.oddsUnits ? { ...b, oddsUnits: String(defaultUnitsToWinOne(b.oddsPrice)) } : b
    );
    const archiveFixed = archive.map((b) =>
      b.oddsPrice && !b.oddsUnits ? { ...b, oddsUnits: String(defaultUnitsToWinOne(b.oddsPrice)) } : b
    );
    const liveChanged = liveFixed.filter((b, i) => b.oddsUnits !== bets[i]?.oddsUnits).length;
    const archiveChanged = archiveFixed.filter((b, i) => b.oddsUnits !== archive[i]?.oddsUnits).length;

    Promise.all([
      fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, bets: liveFixed }),
      }),
      fetch("/api/archive", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, archive: archiveFixed }),
      }),
    ]).then(([r1, r2]) => {
      if (r1.ok && r2.ok) {
        setBets(liveFixed);
        setArchive(archiveFixed);
        setImportMsg(`Backfilled units on ${liveChanged + archiveChanged} bet(s) using the odds price (risk-to-win-1 default).`);
      } else {
        setImportMsg("Failed - check passcode.");
      }
      setTimeout(() => setImportMsg(""), 5000);
    });
  }

  if (!unlocked) {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", textAlign: "center" }}>
        <h1><GolfFlagIcon />Golf <span>Tracker</span></h1>
        <div className="subline" style={{ marginBottom: 20 }}>Auto-sync setup</div>
        <div className="lock" style={{ justifyContent: "center" }}>
          <input
            type="password"
            placeholder="passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
          />
          <button onClick={tryUnlock}>Unlock</button>
        </div>
        {lockError && <div className="lock-error">{lockError}</div>}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" className="admin-link">← back to board</Link>
      </div>

      <div className="card" style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div className="player" style={{ fontSize: 14 }}>Backup</div>
          <div className="subline" style={{ marginTop: 2 }}>Downloads everything - bets, recap history, and mapping - as one file.</div>
        </div>
        <button className="add-btn-inline" onClick={downloadBackup}>Download backup</button>
      </div>
      {backupMsg && <div className="subline" style={{ marginBottom: 16 }}>{backupMsg}</div>}

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button className={tab === "bets" ? "add-btn-inline" : "recap-btn"} onClick={() => setTab("bets")}>
          Bets
        </button>
        <button className={tab === "tournaments" ? "add-btn-inline" : "recap-btn"} onClick={() => setTab("tournaments")}>
          Tournaments
        </button>
        <button className={tab === "parlays" ? "add-btn-inline" : "recap-btn"} onClick={() => setTab("parlays")}>
          Parlays
        </button>
      </div>

      {tab === "bets" && (
      <>
      <h1 style={{ marginBottom: 4 }}>Load tonight's bets</h1>
      <div className="subline" style={{ marginBottom: 12 }}>
        One paste, bet description and odds together - a "Tournament Round N"
        header line, then one line per bet: "TIME Player **Over/Under** Line
        [Greens/Birdies/Bogeys/Pars] Price (DK) for X units". The plain-
        English description (e.g. "11+ pars") is derived automatically from
        the line and side. Score bets need a round par set on the
        Tournaments tab first to convert raw strokes to to-par terms. This
        adds to the board - anything still unresolved from a prior round
        (like a suspended round) stays visible until it's decided.
      </div>
      <label style={{ display: "block", marginBottom: 12, fontSize: 12 }}>
        These bets are for (recap date - set this to when the round is
        actually played, not necessarily today, e.g. pasting Round 4 the
        night before)
        <input
          type="date"
          value={betsDate}
          onChange={(e) => setBetsDate(e.target.value)}
          style={{
            display: "block", width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)",
            border: "1px solid var(--line)", color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace",
            fontSize: 13, padding: "8px 10px", borderRadius: 3,
          }}
        />
      </label>
      <button className="add-btn-inline" onClick={backfillMissingUnits} style={{ marginBottom: 12 }}>
        Backfill missing units on existing bets
      </button>
      <textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder={"Scottish Open Round 4\n6:55 AM Rory McIlroy **Over** 10.5 Pars -122 (DK) for 1.22 units\n7:28 AM Ryan Gerard **Under** 69.5 -114 (DK) for 1.14 units\n..."}
        rows={10}
        style={{
          width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
          color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
          padding: "10px", borderRadius: 4, marginBottom: 8, resize: "vertical",
        }}
      />
      <button className="add-btn-inline" onClick={previewImport} style={{ marginRight: 8 }}>
        Preview
      </button>

      {preview && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="player" style={{ marginBottom: 8 }}>
            {preview.bets.length} bet{preview.bets.length === 1 ? "" : "s"} parsed
          </div>
          {preview.bets.map((b) => (
            <div key={b.id} className="bet-text" style={{ marginBottom: 4 }}>
              {b.t} · {b.r} · {b.time} · <b style={{ color: "var(--cream)" }}>{b.player}</b> · {b.bet} · {b.oddsLine} · DK {b.oddsPrice ?? "—"} · {b.oddsUnits}u
            </div>
          ))}
          {preview.warnings.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {preview.warnings.map((w, i) => (
                <div key={i} className="lock-error" style={{ marginBottom: 4 }}>{w}</div>
              ))}
            </div>
          )}
          <button
            className="add-btn-inline"
            onClick={confirmImport}
            disabled={preview.bets.length === 0}
            style={{ marginTop: 12, width: "100%", padding: 10 }}
          >
            Add these {preview.bets.length} bets to the board
          </button>
        </div>
      )}
      {importMsg && <div className="subline" style={{ marginTop: 8 }}>{importMsg}</div>}

      <h1 style={{ marginTop: 36, marginBottom: 4 }}>Add a tournament-long bet</h1>
      <div className="subline" style={{ marginBottom: 12 }}>
        For bets on the eventual winning score (not tied to one player or
        round). Tracks the current tournament leader's live score-to-par
        automatically, but never grades itself - settle it by hand once the
        tournament actually finishes.
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
          Tournament
          <select
            value={winnerTournament}
            onChange={(e) => setWinnerTournament(e.target.value)}
            style={{
              width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
              color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
              padding: "8px 10px", borderRadius: 3,
            }}
          >
            <option value="">— choose —</option>
            {tournaments.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <label style={{ flex: 1, fontSize: 12 }}>
            Side
            <select
              value={winnerSide}
              onChange={(e) => setWinnerSide(e.target.value as "Under" | "Over")}
              style={{
                width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                padding: "8px 10px", borderRadius: 3,
              }}
            >
              <option value="Under">Under</option>
              <option value="Over">Over</option>
            </select>
          </label>
          <label style={{ flex: 1, fontSize: 12 }}>
            Line (total strokes, e.g. 268.5)
            <input
              placeholder="268.5"
              value={winnerStrokes}
              onChange={(e) => setWinnerStrokes(e.target.value)}
              style={{
                width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                padding: "8px 10px", borderRadius: 3,
              }}
            />
          </label>
        </div>

        <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
          Course total par (4 rounds - default 288 = par 72 x 4)
          <input
            value={winnerCoursePar}
            onChange={(e) => setWinnerCoursePar(e.target.value)}
            style={{
              width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
              color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
              padding: "8px 10px", borderRadius: 3,
            }}
          />
          {winnerStrokes && !isNaN(parseFloat(winnerStrokes)) && !isNaN(parseFloat(winnerCoursePar)) && (
            <div className="subline" style={{ marginTop: 4, textTransform: "none", letterSpacing: 0 }}>
              = target {Math.round((parseFloat(winnerStrokes) - parseFloat(winnerCoursePar)) * 2) / 2 > 0 ? "+" : ""}
              {Math.round((parseFloat(winnerStrokes) - parseFloat(winnerCoursePar)) * 2) / 2} to par
            </div>
          )}
        </label>

        <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
          Odds (e.g. -112)
          <input
            placeholder="-112"
            value={winnerOdds}
            onChange={(e) => setWinnerOdds(e.target.value)}
            style={{
              width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
              color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
              padding: "8px 10px", borderRadius: 3,
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
          Wager ($)
          <input
            type="number"
            placeholder="25"
            value={winnerWagerDollars}
            onChange={(e) => setWinnerWagerDollars(e.target.value)}
            style={{
              width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
              color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
              padding: "8px 10px", borderRadius: 3,
            }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 12, fontSize: 12 }}>
          Date
          <input
            type="date"
            value={winnerDate}
            onChange={(e) => setWinnerDate(e.target.value)}
            style={{
              width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
              color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
              padding: "8px 10px", borderRadius: 3,
            }}
          />
        </label>

        <button className="add-btn-inline" onClick={submitWinnerBet} style={{ width: "100%", padding: 10 }}>
          Add bet
        </button>
        {winnerMsg && <div className="subline" style={{ marginTop: 8 }}>{winnerMsg}</div>}
      </div>

      <h1 style={{ marginTop: 36, marginBottom: 4 }}>Live board rounds</h1>
      <div className="subline" style={{ marginBottom: 12 }}>
        Rounds archive to the recap automatically once every bet in them is
        decided. Use this only if one will never fully resolve (withdrawal,
        etc.) and you want to file it away manually.
      </div>
      {roundGroups.map((g) => (
        <div key={`${g.t}|||${g.r}`} className="card" style={{ marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="player" style={{ fontSize: 14 }}>{g.t} · {g.r}</div>
            <div className="subline" style={{ marginTop: 2 }}>{g.decided} decided · {g.pending} still pending/live</div>
          </div>
          <button className="add-btn-inline" onClick={() => forceArchive(g.t, g.r)}>
            Force archive
          </button>
        </div>
      ))}
      {forceMsg && <div className="subline" style={{ marginBottom: 8 }}>{forceMsg}</div>}

      <h1 style={{ marginTop: 36, marginBottom: 4 }}>Archived rounds</h1>
      <div className="subline" style={{ marginBottom: 12 }}>
        Everything currently sitting in the recap. Restore a round to bring
        it back to the live board (e.g. one archived before today's
        "stay visible until the day is over" rule existed). Delete removes
        it permanently - useful for cleaning up a junk entry, like one that
        got force-archived under the wrong tournament or round name.
      </div>
      {archiveGroups.length === 0 && <div className="subline">Nothing archived yet.</div>}
      {Object.entries(
        archiveGroups.reduce((acc: Record<string, typeof archiveGroups>, g) => {
          (acc[g.t] = acc[g.t] || []).push(g);
          return acc;
        }, {})
      ).map(([tourn, rounds]) => {
        const isOpen = expandedArchiveTourn === tourn;
        const totalWins = rounds.reduce((s, r) => s + r.wins, 0);
        const totalLosses = rounds.reduce((s, r) => s + r.losses, 0);
        return (
          <div key={tourn} style={{ marginBottom: 10 }}>
            <div
              className="card"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
              onClick={() => setExpandedArchiveTourn(isOpen ? null : tourn)}
            >
              <div className="player" style={{ fontSize: 14 }}>{tourn}</div>
              <div className="subline" style={{ margin: 0 }}>
                {rounds.length} round{rounds.length === 1 ? "" : "s"} · {totalWins}W-{totalLosses}L · {isOpen ? "▲" : "▼"}
              </div>
            </div>
            {isOpen && (
              <div style={{ marginTop: 8, paddingLeft: 12 }}>
                {rounds.map((g) => {
                  const key = `${g.t}|||${g.r}`;
                  const editValue = dateFixEdits[key] ?? g.currentDate;
                  return (
                    <div key={key} className="card" style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div>
                          <div className="player" style={{ fontSize: 14 }}>{g.t} · {g.r}</div>
                          <div className="subline" style={{ marginTop: 2 }}>
                            {g.wins}W-{g.losses}L · {g.total} bet{g.total === 1 ? "" : "s"}
                            {g.currentDate ? ` · dated ${g.currentDate}` : " · no date set"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="add-btn-inline" onClick={() => restoreArchiveGroup(g.t, g.r)}>
                            Restore to board
                          </button>
                          <button className="resume-btn" onClick={() => deleteArchiveGroup(g.t, g.r)} style={{ color: "var(--clay)", borderColor: "rgba(192,106,76,0.4)" }}>
                            Delete from recap
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="date"
                          value={editValue}
                          onChange={(e) => setDateFixEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                          style={{
                            background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                            color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
                            padding: "6px 8px", borderRadius: 3,
                          }}
                        />
                        <button className="recap-btn" onClick={() => fixArchiveGroupDate(g.t, g.r, editValue)}>
                          Fix date
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </>
      )}

      {tab === "tournaments" && (
      <>
      <h1 style={{ marginBottom: 4 }}>Add a tournament</h1>
      <div className="subline" style={{ marginBottom: 12 }}>
        Tournaments stay listed here permanently once added, even after all
        their bets archive to the recap - so you can set next week's mapping
        ahead of time, or fix an old tournament's dates whenever.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          placeholder="e.g. ISCO Championship"
          value={newTournName}
          onChange={(e) => setNewTournName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTournament()}
          style={{
            flex: 1, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
            color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
            padding: "8px 10px", borderRadius: 3,
          }}
        />
        <button className="add-btn-inline" onClick={addTournament}>Add</button>
      </div>

      <h1 style={{ marginBottom: 4 }}>Auto-sync setup</h1>
      <div className="subline" style={{ marginBottom: 20 }}>
        One number per tournament. Open the tournament's leaderboard on pgatour.com
        and copy the "Rxxxxxxx" segment from the URL - for example
        pgatour.com/tournaments/2026/isco-championship/<b>R2026518</b>/leaderboard.
      </div>

      {tournaments.map((tourn) => {
        const tm = mapping.tournaments[tourn];
        const isSuspended = !!tm?.suspendedType && tm.suspendedType !== "none";
        function updateTourn(patch: Partial<{
          pgaId: string; suspendedType: string; suspendedUntil: string; dateRange: string;
          venue: string; location: string; latitude: number; longitude: number;
          startDate: string; endDate: string; notes: string; upcoming: boolean; roundPar: number;
        }>) {
          setMapping((m) => ({
            ...m,
            tournaments: {
              ...m.tournaments,
              [tourn]: { ...m.tournaments[tourn], pgaId: m.tournaments[tourn]?.pgaId || "", ...patch } as any,
            },
          }));
        }
        return (
          <div key={tourn} className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="player">{tourn}</div>
              <button
                className="resume-btn"
                onClick={() => removeTournament(tourn)}
                style={{ fontSize: 9 }}
              >
                Remove
              </button>
            </div>
            <input
              placeholder="e.g. R2026518"
              value={tm?.pgaId || ""}
              onChange={(e) => updateTourn({ pgaId: e.target.value })}
              style={{
                width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                padding: "8px 10px", borderRadius: 3,
              }}
            />
            <label style={{ display: "block", marginTop: 10, fontSize: 12 }}>
              Dates (for the recap page, e.g. "July 9-12, 2026")
              <input
                placeholder="July 9-12, 2026"
                value={tm?.dateRange || ""}
                onChange={(e) => updateTourn({ dateRange: e.target.value })}
                style={{
                  width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                  color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                  padding: "8px 10px", borderRadius: 3,
                }}
              />
            </label>
            <label style={{ display: "block", marginTop: 10, fontSize: 12 }}>
              Round par (needed to convert score bets - e.g. "Under 68.5" needs
              to know par is 70 to become "-2 or better")
              <input
                placeholder="70"
                value={tm?.roundPar ?? ""}
                onChange={(e) => updateTourn({ roundPar: parseInt(e.target.value, 10) || undefined })}
                style={{
                  width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                  color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                  padding: "8px 10px", borderRadius: 3,
                }}
              />
            </label>

            <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 14 }}>
              <div className="subline" style={{ marginBottom: 8 }}>For the "upcoming this week" widget on the live board</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={!!tm?.upcoming} onChange={(e) => updateTourn({ upcoming: e.target.checked })} />
                Show on live board as upcoming this week
              </label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <label style={{ flex: 1, fontSize: 12 }}>
                  Venue
                  <input
                    placeholder="Royal Birkdale Golf Club"
                    value={tm?.venue || ""}
                    onChange={(e) => updateTourn({ venue: e.target.value })}
                    style={{
                      width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                      color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                      padding: "8px 10px", borderRadius: 3,
                    }}
                  />
                </label>
                <label style={{ flex: 1, fontSize: 12 }}>
                  Location
                  <input
                    placeholder="Southport, England"
                    value={tm?.location || ""}
                    onChange={(e) => updateTourn({ location: e.target.value })}
                    style={{
                      width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                      color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                      padding: "8px 10px", borderRadius: 3,
                    }}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <label style={{ flex: 1, fontSize: 12 }}>
                  Latitude
                  <input
                    placeholder="53.6329"
                    value={tm?.latitude ?? ""}
                    onChange={(e) => updateTourn({ latitude: parseFloat(e.target.value) || undefined })}
                    style={{
                      width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                      color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                      padding: "8px 10px", borderRadius: 3,
                    }}
                  />
                </label>
                <label style={{ flex: 1, fontSize: 12 }}>
                  Longitude
                  <input
                    placeholder="-3.0323"
                    value={tm?.longitude ?? ""}
                    onChange={(e) => updateTourn({ longitude: parseFloat(e.target.value) || undefined })}
                    style={{
                      width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                      color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                      padding: "8px 10px", borderRadius: 3,
                    }}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <label style={{ flex: 1, fontSize: 12 }}>
                  Start date
                  <input
                    type="date"
                    value={tm?.startDate || ""}
                    onChange={(e) => updateTourn({ startDate: e.target.value })}
                    style={{
                      width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                      color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                      padding: "8px 10px", borderRadius: 3,
                    }}
                  />
                </label>
                <label style={{ flex: 1, fontSize: 12 }}>
                  End date
                  <input
                    type="date"
                    value={tm?.endDate || ""}
                    onChange={(e) => updateTourn({ endDate: e.target.value })}
                    style={{
                      width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                      color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                      padding: "8px 10px", borderRadius: 3,
                    }}
                  />
                </label>
              </div>
              <label style={{ display: "block", fontSize: 12 }}>
                Notes (purse, defending champ, field strength, etc.)
                <textarea
                  placeholder="Defending champion: ... · Purse: $... · Field: ..."
                  value={tm?.notes || ""}
                  onChange={(e) => updateTourn({ notes: e.target.value })}
                  style={{
                    width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                    color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                    padding: "8px 10px", borderRadius: 3, minHeight: 60, resize: "vertical",
                  }}
                />
              </label>
            </div>
            <label style={{ display: "block", marginTop: 10, fontSize: 12 }}>
              Play suspended?
              <select
                value={tm?.suspendedType || "none"}
                onChange={(e) => updateTourn({ suspendedType: e.target.value })}
                style={{
                  width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                  color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                  padding: "8px 10px", borderRadius: 3,
                }}
              >
                <option value="none">Not suspended</option>
                <option value="fog">Fog</option>
                <option value="storm">Storms</option>
                <option value="dark">Darkness</option>
              </select>
            </label>
            {isSuspended && (
              <label style={{ display: "block", marginTop: 10, fontSize: 12 }}>
                Auto-resume at (Central time)
                <input
                  type="datetime-local"
                  value={tm?.suspendedUntil || ""}
                  onChange={(e) => updateTourn({ suspendedUntil: e.target.value })}
                  style={{
                    width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                    color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                    padding: "8px 10px", borderRadius: 3,
                  }}
                />
                <div className="subline" style={{ marginTop: 4, textTransform: "none", letterSpacing: 0 }}>
                  Leave blank to lift it manually instead.
                </div>
              </label>
            )}
          </div>
        );
      })}

      <button className="add-btn-inline" onClick={saveMapping} style={{ width: "100%", padding: 10 }}>
        Save mapping
      </button>
      {saveMsg && <div className="subline" style={{ marginTop: 8 }}>{saveMsg}</div>}

      <div className="subline" style={{ marginTop: 24, marginBottom: 40 }}>
        Auto-fills round score, GIR, birdies, and bogeys for every bet on the
        board, matched to players by name. Edit any stat by hand and it locks
        that bet out of auto-sync until you hit "Resume auto" on it.
      </div>
      </>
      )}

      {tab === "parlays" && (
      <>
      <h1 style={{ marginBottom: 4 }}>Unit size</h1>
      <div className="subline" style={{ marginBottom: 12 }}>
        Used to convert a dollar wager into units for parlays.
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 24 }}>
        <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>$</span>
        <input
          type="number"
          value={settings.unitSizeDollars}
          onChange={(e) => setSettings({ unitSizeDollars: parseFloat(e.target.value) || 0 })}
          style={{
            width: 100, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
            color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
            padding: "8px 10px", borderRadius: 3,
          }}
        />
        <span style={{ fontSize: 13, color: "var(--cream-dim)" }}>per unit</span>
        <button className="add-btn-inline" onClick={saveSettings}>Save</button>
        {settingsMsg && <span className="subline" style={{ marginLeft: 4 }}>{settingsMsg}</span>}
      </div>

      <h1 style={{ marginBottom: 4 }}>Build a parlay</h1>
      <div className="subline" style={{ marginBottom: 12 }}>
        Check off the legs (works for live or already-resolved bets), then
        fill in the slip's odds and wager. Status tracks itself from the
        legs you pick - it doesn't fetch anything on its own. Parlays are
        tracked completely separately from your straight-bet units.
      </div>

      {pickableBets.length === 0 && <div className="subline">No bets loaded yet to build a parlay from.</div>}

      {Object.entries(
        pickableBets.reduce((acc: Record<string, Bet[]>, b) => {
          const key = `${b.t} · ${b.r}`;
          (acc[key] = acc[key] || []).push(b);
          return acc;
        }, {})
      ).map(([group, groupBets]) => (
        <div key={group} className="card" style={{ marginBottom: 10 }}>
          <div className="player" style={{ fontSize: 13, marginBottom: 8 }}>{group}</div>
          {groupBets.map((b) => (
            <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={selectedLegIds.has(b.id)} onChange={() => toggleLeg(b.id)} />
              <span style={{ color: "var(--cream)" }}>{b.player}</span>
              <span style={{ color: "var(--cream-dim)" }}>{b.bet}</span>
              <span
                className={`tsum ${b.status === "hit" ? "win" : b.status === "miss" ? "loss" : b.status === "live" ? "live" : "tbd"}`}
                style={{ marginLeft: "auto" }}
              >
                {b.status === "hit" ? "WIN" : b.status === "miss" ? "LOSS" : b.status === "live" ? "LIVE" : "TBD"}
              </span>
            </label>
          ))}
        </div>
      ))}

      <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="player" style={{ fontSize: 13, marginBottom: 8 }}>
          {selectedLegIds.size} leg{selectedLegIds.size === 1 ? "" : "s"} selected
        </div>
        <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
          Label (optional)
          <input
            placeholder={`e.g. ${selectedLegIds.size || "N"} Pick Parlay`}
            value={parlayLabel}
            onChange={(e) => setParlayLabel(e.target.value)}
            style={{
              width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
              color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
              padding: "8px 10px", borderRadius: 3,
            }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
          Odds (e.g. +950)
          <input
            placeholder="+950"
            value={parlayOdds}
            onChange={(e) => setParlayOdds(e.target.value)}
            style={{
              width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
              color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
              padding: "8px 10px", borderRadius: 3,
            }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 10, fontSize: 12 }}>
          Wager ($)
          <input
            type="number"
            placeholder="25"
            value={parlayWagerDollars}
            onChange={(e) => setParlayWagerDollars(e.target.value)}
            style={{
              width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
              color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
              padding: "8px 10px", borderRadius: 3,
            }}
          />
          {parlayWagerDollars && !isNaN(parseFloat(parlayWagerDollars)) && (
            <div className="subline" style={{ marginTop: 4, textTransform: "none", letterSpacing: 0 }}>
              = {Math.round((parseFloat(parlayWagerDollars) / (settings.unitSizeDollars || 50)) * 100) / 100}u
            </div>
          )}
        </label>
        <label style={{ display: "block", marginBottom: 12, fontSize: 12 }}>
          Date
          <input
            type="date"
            value={parlayDate}
            onChange={(e) => setParlayDate(e.target.value)}
            style={{
              width: "100%", marginTop: 6, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
              color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
              padding: "8px 10px", borderRadius: 3,
            }}
          />
        </label>
        <button className="add-btn-inline" onClick={submitParlay} style={{ width: "100%", padding: 10 }}>
          Add parlay
        </button>
        {parlayMsg && <div className="subline" style={{ marginTop: 8 }}>{parlayMsg}</div>}
      </div>

      {(liveParlays.length > 0 || parlayArchiveList.length > 0) && (
        <>
          <div className="round-label">All parlays (tap a name to rename it)</div>
          {[...liveParlays, ...parlayArchiveList].map((p) => (
            <div key={p.id} className="card" style={{ marginBottom: 8 }}>
              {renamingId === p.id ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveRename(p.id)}
                    style={{
                      flex: 1, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
                      color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
                      padding: "6px 8px", borderRadius: 3,
                    }}
                  />
                  <button className="add-btn-inline" onClick={() => saveRename(p.id)}>Save</button>
                </div>
              ) : (
                <div className="player" style={{ fontSize: 13, cursor: "pointer" }} onClick={() => startRename(p)}>
                  {p.label} · {p.oddsPrice} · {p.wagerUnits}u
                </div>
              )}
              <div className="subline" style={{ marginTop: 4 }}>
                {p.legs.length} legs · {p.loadedDate} · {p.status === "hit" ? "WIN" : p.status === "miss" ? "LOSS" : "open"}
              </div>
            </div>
          ))}
        </>
      )}
      </>
      )}
    </main>
  );
}

