"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bet } from "../../lib/seed";
import { Mapping, EMPTY_MAPPING } from "../../lib/mapping";
import { parseBetsText, ParseResult } from "../../lib/parseBets";
import { parseOddsText, attachOddsToBets, OddsParseResult } from "../../lib/parseOdds";
import { nowInCentral } from "../../lib/centralTime";
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

  const [oddsText, setOddsText] = useState("");
  const [oddsPreview, setOddsPreview] = useState<OddsParseResult | null>(null);
  const [oddsMsg, setOddsMsg] = useState("");

  const [forceMsg, setForceMsg] = useState("");
  const [tab, setTab] = useState<"bets" | "tournaments">("bets");
  const [newTournName, setNewTournName] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("bb_passcode");
    if (stored) {
      setPasscode(stored);
      setUnlocked(true);
    }
    fetch("/api/bets").then((r) => r.json()).then((d) => setBets(d.bets || []));
    fetch("/api/mapping").then((r) => r.json()).then((d) => setMapping(d.mapping || EMPTY_MAPPING));
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

  function previewImport() {
    setImportMsg("");
    setPreview(parseBetsText(importText, betsDate));
  }

  function confirmImport() {
    if (!preview || preview.bets.length === 0) return;
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
          setImportMsg(`Added ${preview.bets.length} bets. Anything still unresolved from before stays on the board too.`);
          setBets(merged);
          setPreview(null);
          setImportText("");
          setBetsDate(nowInCentral().dateStr);
        } else {
          setImportMsg("Failed to save - check passcode.");
        }
      });
  }

  function previewOdds() {
    setOddsMsg("");
    setOddsPreview(parseOddsText(oddsText));
  }

  function confirmOdds() {
    if (!oddsPreview || oddsPreview.entries.length === 0) return;
    const { bets: updatedBets, matched, warnings } = attachOddsToBets(oddsPreview.entries, bets);
    fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, bets: updatedBets }),
    }).then((r) => {
      if (r.ok) {
        setOddsMsg(`Matched ${matched} of ${oddsPreview.entries.length} lines.${warnings.length ? " " + warnings.length + " warning(s) below." : ""}`);
        setBets(updatedBets);
        setOddsPreview({ entries: [], warnings });
        setOddsText("");
      } else {
        setOddsMsg("Failed to save - check passcode.");
      }
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

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button className={tab === "bets" ? "add-btn-inline" : "recap-btn"} onClick={() => setTab("bets")}>
          Bets
        </button>
        <button className={tab === "tournaments" ? "add-btn-inline" : "recap-btn"} onClick={() => setTab("tournaments")}>
          Tournaments
        </button>
      </div>

      {tab === "bets" && (
      <>
      <h1 style={{ marginBottom: 4 }}>Load tonight's bets</h1>
      <div className="subline" style={{ marginBottom: 12 }}>
        Paste the nightly list in the usual format - a tournament header line,
        a "Round N:" line, then one "TIME Player Name bet type:" line per bet.
        This adds to the board - anything still unresolved from a prior round
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
      <textarea
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder={"ISCO Championship:\nRound 3:\n11:00 AM Jackson Koivun -2 or better:\n..."}
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
              {b.t} · {b.r} · {b.time} · <b style={{ color: "var(--cream)" }}>{b.player}</b> · {b.bet}
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

      <h1 style={{ marginTop: 36, marginBottom: 4 }}>Load odds & lines</h1>
      <div className="subline" style={{ marginBottom: 12 }}>
        Paste the DraftKings-style odds block - a "Tournament Round N" header
        line, then one "Player **Over/Under** Line ... (DK) for X units" line
        per bet. Only the DK price is kept even if other books are listed.
        Matches onto existing bets by player + category + round.
      </div>
      <textarea
        value={oddsText}
        onChange={(e) => setOddsText(e.target.value)}
        placeholder={"ISCO Championship Round 3\nLucas Glover **Under** 69.5 -112 (DK) for 1.12 units\n..."}
        rows={8}
        style={{
          width: "100%", background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)",
          color: "var(--cream)", fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
          padding: "10px", borderRadius: 4, marginBottom: 8, resize: "vertical",
        }}
      />
      <button className="add-btn-inline" onClick={previewOdds} style={{ marginRight: 8 }}>
        Preview
      </button>

      {oddsPreview && oddsPreview.entries.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="player" style={{ marginBottom: 8 }}>
            {oddsPreview.entries.length} line{oddsPreview.entries.length === 1 ? "" : "s"} parsed
          </div>
          {oddsPreview.entries.map((e, i) => (
            <div key={i} className="bet-text" style={{ marginBottom: 4 }}>
              {e.tournament} · {e.round} · <b style={{ color: "var(--cream)" }}>{e.player}</b> · {e.side} {e.lineValue} ({e.category}) · DK {e.oddsDK ?? "—"} · {e.units ?? "—"}u
            </div>
          ))}
          {oddsPreview.warnings.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {oddsPreview.warnings.map((w, i) => (
                <div key={i} className="lock-error" style={{ marginBottom: 4 }}>{w}</div>
              ))}
            </div>
          )}
          <button
            className="add-btn-inline"
            onClick={confirmOdds}
            style={{ marginTop: 12, width: "100%", padding: 10 }}
          >
            Attach these {oddsPreview.entries.length} lines to matching bets
          </button>
        </div>
      )}
      {oddsPreview && oddsPreview.entries.length === 0 && oddsPreview.warnings.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {oddsPreview.warnings.map((w, i) => (
            <div key={i} className="lock-error" style={{ marginBottom: 4 }}>{w}</div>
          ))}
        </div>
      )}
      {oddsMsg && <div className="subline" style={{ marginTop: 8 }}>{oddsMsg}</div>}

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
        function updateTourn(patch: Partial<{ pgaId: string; suspendedType: string; suspendedUntil: string; dateRange: string }>) {
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
    </main>
  );
}

