"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bet } from "../../lib/seed";
import { Mapping, EMPTY_MAPPING } from "../../lib/mapping";
import { parseBetType, trendClassName, friendlyLabel, formatScore } from "../../lib/betLogic";
import { computeUnitResult, formatUnits, oddsMultiplier } from "../../lib/units";
import { centralDateFromISO } from "../../lib/centralTime";
import { Parlay } from "../../lib/parlay";
import GolfFlagIcon from "../GolfFlagIcon";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAY_NAMES = ["S","M","T","W","T","F","S"];

function pad(n: number) { return String(n).padStart(2, "0"); }

function aggregate(bets: Bet[]): { wins: number; losses: number; units: number } {
  let wins = 0, losses = 0, units = 0;
  for (const b of bets) {
    if (b.status === "hit") wins++;
    if (b.status === "miss") losses++;
    const u = computeUnitResult(b.oddsPrice, b.oddsUnits, b.status);
    if (u !== null) units += u;
  }
  return { wins, losses, units: Math.round(units * 100) / 100 };
}

function BetDetailCard({ b, compact = false }: { b: Bet; compact?: boolean }) {
  const parsed = parseBetType(b.bet);
  const cls = trendClassName(parsed, b.stat, b.thru);
  const unitResult = computeUnitResult(b.oddsPrice, b.oddsUnits, b.status);
  return (
    <div className={`card ${b.status}`} style={{ marginBottom: 8 }}>
      <div className="card-top" style={{ alignItems: "center" }}>
        {compact ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
            <span className="time">{b.time}</span>
            <span className="player" style={{ fontSize: 14 }}>{b.player}</span>
            <span className="bet-text" style={{ margin: 0 }}>{b.bet}</span>
            {b.oddsLine && <span className="odds-line" style={{ margin: 0 }}>{b.oddsLine} · DK {b.oddsPrice ?? "—"}</span>}
          </div>
        ) : (
          <div className="who">
            <div className="time">{b.time}</div>
            <div className="player">{b.player}</div>
            <div className="bet-text">{b.bet}</div>
            {b.oddsLine && <div className="odds-line">{b.oddsLine} · DK {b.oddsPrice ?? "—"}</div>}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className={`sbtn ${b.status === "hit" ? "win active" : b.status === "miss" ? "loss active" : ""}`} style={{ cursor: "default" }}>
            {b.status === "hit" ? "WIN" : b.status === "miss" ? "LOSS" : "TBD"}
          </span>
          {unitResult !== null && (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: unitResult >= 0 ? "var(--live)" : "var(--clay)" }}>
              {formatUnits(unitResult)}
            </span>
          )}
        </div>
      </div>
      {!compact && (
        <>
          <div className="scorecard">
            <div className="sc-cell">
              <div className="sc-label">{friendlyLabel(parsed.label)}</div>
              <div className="sc-target">{parsed.targetDisplay}</div>
            </div>
            <div className="sc-cell">
              <div className="sc-label">{friendlyLabel(parsed.label)}</div>
              <div className={`sc-target ${cls}`}>{parsed.label === "SCORE" ? formatScore(b.stat) : b.stat ?? "—"}</div>
            </div>
            <div className="sc-cell">
              <div className="sc-label">Thru</div>
              <div className="sc-target">{b.thru ?? "—"}</div>
            </div>
          </div>
          {b.auto && (
            <div className="auto-row">
              <span className="detail-strip">
                Score {formatScore(b.auto.scoreToPar)} · Greens {b.auto.gir ?? "—"} · Fairways {b.auto.fairways ?? "—"} ·
                {" "}Birdies {b.auto.birdies ?? "—"} · Bogeys {b.auto.bogeys ?? "—"} · Pars {b.auto.pars ?? "—"}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function RecapPage() {
  const [archive, setArchive] = useState<Bet[]>([]);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [view, setView] = useState<"calendar" | "tournament" | "parlays">("calendar");
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedTourn, setExpandedTourn] = useState<string | null>(null);
  const [expandedRound, setExpandedRound] = useState<string | null>(null);
  const [quickViewRound, setQuickViewRound] = useState<string | null>(null);
  const [parlayArchive, setParlayArchive] = useState<Parlay[]>([]);
  const [expandedParlay, setExpandedParlay] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/archive").then((r) => r.json()).then((d) => setArchive(d.archive || []));
    fetch("/api/mapping").then((r) => r.json()).then((d) => setMapping(d.mapping || EMPTY_MAPPING));
    fetch("/api/parlay-archive").then((r) => r.json()).then((d) => setParlayArchive(d.archive || []));
  }, []);

  const dayMap = useMemo(() => {
    const m: Record<string, Bet[]> = {};
    archive.forEach((b) => {
      const d = b.loadedDate || (b.archivedAt ? centralDateFromISO(b.archivedAt) : "unknown");
      (m[d] = m[d] || []).push(b);
    });
    return m;
  }, [archive]);

  const monthAgg = useMemo(() => {
    const prefix = `${viewYear}-${pad(viewMonth + 1)}-`;
    const monthBets = Object.keys(dayMap)
      .filter((d) => d.startsWith(prefix))
      .flatMap((d) => dayMap[d]);
    return aggregate(monthBets);
  }, [dayMap, viewYear, viewMonth]);

  const tournMap = useMemo(() => {
    const m: Record<string, Bet[]> = {};
    archive.forEach((b) => {
      (m[b.t] = m[b.t] || []).push(b);
    });
    return m;
  }, [archive]);

  const lastRound = useMemo(() => {
    const groups: Record<string, Bet[]> = {};
    archive.forEach((b) => {
      const key = `${b.t}|||${b.r}`;
      (groups[key] = groups[key] || []).push(b);
    });
    let bestKey: string | null = null;
    let bestTime = "";
    for (const key of Object.keys(groups)) {
      const t = groups[key][0]?.archivedAt || "";
      if (t > bestTime) {
        bestTime = t;
        bestKey = key;
      }
    }
    return bestKey ? { key: bestKey, bets: groups[bestKey] } : null;
  }, [archive]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
    setSelectedDate(null);
  }

  const selectedBets = selectedDate ? dayMap[selectedDate] || [] : [];
  const selectedGroups: Record<string, Bet[]> = {};
  selectedBets.forEach((b) => {
    const key = `${b.t}|||${b.r}`;
    (selectedGroups[key] = selectedGroups[key] || []).push(b);
  });

  return (
    <>
      <header>
        <div className="title-row">
          <h1><GolfFlagIcon />Golf <span>Tracker</span></h1>
          <div className="header-actions">
            <button
              className={view === "calendar" ? "add-btn-inline" : "recap-btn"}
              onClick={() => setView("calendar")}
            >
              Calendar
            </button>
            <button
              className={view === "tournament" ? "add-btn-inline" : "recap-btn"}
              onClick={() => setView("tournament")}
            >
              By tournament
            </button>
            <button
              className={view === "parlays" ? "add-btn-inline" : "recap-btn"}
              onClick={() => setView("parlays")}
            >
              Parlays
            </button>
            <Link href="/analysis" className="recap-btn">Analysis</Link>
          </div>
        </div>
        <div className="subline">
          Recap <Link href="/" className="admin-link">· back to board</Link>
        </div>
      </header>

      <main>
        {archive.length === 0 && <div className="empty">No resolved rounds yet - they'll show up here once a round finishes.</div>}

        {view === "calendar" && archive.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button className="resume-btn" onClick={() => changeMonth(-1)}>← Prev</button>
              <div style={{ textAlign: "center" }}>
                <div className="player">{MONTH_NAMES[viewMonth]} {viewYear}</div>
                {(monthAgg.wins > 0 || monthAgg.losses > 0) && (
                  <div style={{ fontSize: 11, marginTop: 2 }}>
                    <span className="tsum win">{monthAgg.wins}W</span>{" "}
                    <span className="tsum loss">{monthAgg.losses}L</span>{" "}
                    <span className={monthAgg.units >= 0 ? "tsum win" : "tsum loss"}>{formatUnits(monthAgg.units)}</span>
                  </div>
                )}
              </div>
              <button className="resume-btn" onClick={() => changeMonth(1)}>Next →</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 16 }}>
              {WEEKDAY_NAMES.map((w, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 10, color: "var(--cream-dim)", fontFamily: "'Oswald',sans-serif" }}>{w}</div>
              ))}
              {Array.from({ length: firstWeekday }).map((_, i) => <div key={"blank" + i} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
                const dayBets = dayMap[dateStr];
                const agg = dayBets ? aggregate(dayBets) : null;
                const hasData = !!agg && (agg.wins > 0 || agg.losses > 0);
                let bg = "rgba(241,236,221,0.03)";
                if (hasData) {
                  bg = agg!.units > 0 ? "rgba(76,175,110,0.16)" : agg!.units < 0 ? "rgba(192,106,76,0.16)" : "rgba(228,190,74,0.12)";
                }
                return (
                  <div
                    key={day}
                    onClick={() => hasData && setSelectedDate(dateStr)}
                    style={{
                      background: bg, borderRadius: 4, padding: "6px 4px", minHeight: 52,
                      cursor: hasData ? "pointer" : "default",
                      border: selectedDate === dateStr ? "1px solid var(--gold-bright)" : "1px solid var(--line)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--cream-dim)" }}>{day}</div>
                    {hasData && (
                      <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>
                        <div style={{ color: "var(--cream)" }}>{agg!.wins}-{agg!.losses}</div>
                        <div style={{ color: agg!.units >= 0 ? "var(--live)" : "var(--clay)" }}>{formatUnits(agg!.units)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {lastRound && (
              <div style={{ marginBottom: 20 }}>
                <div className="round-label">Last round</div>
                {(() => {
                  const [t, r] = lastRound.key.split("|||");
                  const agg = aggregate(lastRound.bets);
                  return (
                    <div className="tourn">
                      <div className="tourn-head">
                        <h2 style={{ fontSize: 14 }}>{t} · {r}</h2>
                        <div className="tourn-summary">
                          <span className="tsum win">{agg.wins}W</span>
                          <span className="tsum loss">{agg.losses}L</span>
                          <span className={agg.units >= 0 ? "tsum win" : "tsum loss"}>{formatUnits(agg.units)}</span>
                        </div>
                      </div>
                      {lastRound.bets.map((b) => <BetDetailCard key={b.id} b={b} />)}
                    </div>
                  );
                })()}
              </div>
            )}

            {selectedDate && (
              <div>
                <div className="round-label">{selectedDate}</div>
                {Object.keys(selectedGroups).map((key) => {
                  const [t, r] = key.split("|||");
                  const groupBets = selectedGroups[key];
                  const agg = aggregate(groupBets);
                  return (
                    <div key={key} className="tourn" style={{ marginBottom: 14 }}>
                      <div className="tourn-head">
                        <h2 style={{ fontSize: 14 }}>{t} · {r}</h2>
                        <div className="tourn-summary">
                          <span className="tsum win">{agg.wins}W</span>
                          <span className="tsum loss">{agg.losses}L</span>
                          <span className={agg.units >= 0 ? "tsum win" : "tsum loss"}>{formatUnits(agg.units)}</span>
                        </div>
                      </div>
                      {groupBets.map((b) => <BetDetailCard key={b.id} b={b} />)}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {view === "tournament" && archive.length > 0 && (
          <div>
            {Object.keys(tournMap).map((t) => {
              const bets = tournMap[t];
              const agg = aggregate(bets);
              const rounds: Record<string, Bet[]> = {};
              bets.forEach((b) => { (rounds[b.r] = rounds[b.r] || []).push(b); });
              const isOpen = expandedTourn === t;
              return (
                <div key={t} className="tourn" style={{ marginBottom: 14 }}>
                  <div className="tourn-head" style={{ cursor: "pointer" }} onClick={() => setExpandedTourn(isOpen ? null : t)}>
                    <div className="tourn-title-row">
                      <h2>{t}</h2>
                      {mapping.tournaments[t]?.dateRange && (
                        <span className="subline" style={{ marginTop: 0, textTransform: "none", letterSpacing: 0 }}>
                          {mapping.tournaments[t]?.dateRange}
                        </span>
                      )}
                    </div>
                    <div className="tourn-summary">
                      <span className="tsum win">{agg.wins}W</span>
                      <span className="tsum loss">{agg.losses}L</span>
                      <span className={agg.units >= 0 ? "tsum win" : "tsum loss"}>{formatUnits(agg.units)}</span>
                    </div>
                  </div>
                  {isOpen && Object.keys(rounds).map((r) => {
                    const roundBets = rounds[r];
                    const roundAgg = aggregate(roundBets);
                    const roundKey = `${t}|||${r}`;
                    const roundOpen = expandedRound === roundKey;
                    const quickView = quickViewRound === roundKey;
                    return (
                      <div key={r} style={{ marginBottom: 8 }}>
                        <div
                          className="round-label"
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}
                        >
                          <span style={{ cursor: "pointer" }} onClick={() => setExpandedRound(roundOpen ? null : roundKey)}>
                            {r}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{roundAgg.wins}W-{roundAgg.losses}L · {formatUnits(roundAgg.units)}</span>
                            <button
                              className="recap-btn"
                              style={{ fontSize: 9, padding: "4px 8px" }}
                              onClick={() => setQuickViewRound(quickView ? null : roundKey)}
                            >
                              {quickView ? "Exit quick view" : "Enable quick view"}
                            </button>
                          </span>
                        </div>
                        {quickView && (
                          <div style={{ marginBottom: 4, fontSize: 11, color: "var(--cream-dim)", fontFamily: "'Oswald',sans-serif", letterSpacing: "0.05em" }}>
                            {t} · {r} · {roundAgg.wins}W-{roundAgg.losses}L · {formatUnits(roundAgg.units)}
                          </div>
                        )}
                        {quickView
                          ? roundBets.map((b) => <BetDetailCard key={b.id} b={b} compact />)
                          : roundOpen && roundBets.map((b) => <BetDetailCard key={b.id} b={b} />)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {view === "parlays" && (
          <div>
            {parlayArchive.length === 0 && (
              <div className="empty">No decided parlays yet - they show up here once every leg is settled.</div>
            )}
            {parlayArchive.length > 0 && (() => {
              const totalUnits = Math.round(
                parlayArchive.reduce((sum, p) => {
                  if (p.status === "hit") return sum + p.wagerUnits * (oddsMultiplier(p.oddsPrice) || 0);
                  if (p.status === "miss") return sum - p.wagerUnits;
                  return sum;
                }, 0) * 100
              ) / 100;
              const wins = parlayArchive.filter((p) => p.status === "hit").length;
              const losses = parlayArchive.filter((p) => p.status === "miss").length;
              return (
                <div className="tourn-head" style={{ marginBottom: 16 }}>
                  <h2>All parlays</h2>
                  <div className="tourn-summary">
                    <span className="tsum win">{wins}W</span>
                    <span className="tsum loss">{losses}L</span>
                    <span className={totalUnits >= 0 ? "tsum win" : "tsum loss"}>{formatUnits(totalUnits)}</span>
                  </div>
                </div>
              );
            })()}
            {parlayArchive
              .slice()
              .sort((a, b) => (b.archivedAt || "").localeCompare(a.archivedAt || ""))
              .map((p) => {
                const isOpen = expandedParlay === p.id;
                const unitResult = p.status === "hit"
                  ? Math.round(p.wagerUnits * (oddsMultiplier(p.oddsPrice) || 0) * 100) / 100
                  : p.status === "miss" ? -p.wagerUnits : null;
                return (
                  <div key={p.id} className={`card ${p.status}`} style={{ marginBottom: 10, cursor: "pointer" }} onClick={() => setExpandedParlay(isOpen ? null : p.id)}>
                    <div className="card-top">
                      <div className="who">
                        <div className="time">{p.loadedDate}</div>
                        <div className="player">{p.label}</div>
                        <div className="bet-text">{p.oddsPrice} · {p.wagerUnits}u</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <span className={`sbtn ${p.status === "hit" ? "win active" : "loss active"}`} style={{ cursor: "default" }}>
                          {p.status === "hit" ? "WIN" : "LOSS"}
                        </span>
                        {unitResult !== null && (
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: unitResult >= 0 ? "var(--live)" : "var(--clay)" }}>
                            {formatUnits(unitResult)}
                          </span>
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 8 }}>
                        {p.legs.map((leg, i) => (
                          <div key={i} style={{ fontSize: 11, color: "var(--cream-dim)", marginBottom: 4 }}>
                            {leg.tournament} · {leg.player} · {leg.bet}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </main>
    </>
  );
}
