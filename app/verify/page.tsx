"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchFresh } from "../../lib/fetchFresh";

type VerifyData = {
  generatedAt: string;
  betsInProgress: number;
  betsArchived: number;
  totalBets: number;
  fingerprint: string;
  byTournamentRound: Record<string, { wins: number; losses: number; live: number; pending: number }>;
  matches?: {
    id: string; player: string; bet: string; t: string; r: string; personal: boolean;
    status: string; loadedDate: string | null; archivedAt: string | null;
    inLiveArray: boolean; inArchiveArray: boolean;
  }[];
};

export default function VerifyPage() {
  const [data, setData] = useState<VerifyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerQuery, setPlayerQuery] = useState("");

  function load(query?: string) {
    setLoading(true);
    const q = query !== undefined ? query : playerQuery;
    const url = q.trim() ? `/api/verify?player=${encodeURIComponent(q.trim())}` : "/api/verify";
    fetchFresh(url)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(""); }, []);

  return (
    <div className="wrap" style={{ maxWidth: 640, margin: "0 auto", padding: "16px 14px" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/" className="resume-btn" style={{ textDecoration: "none" }}>← Back to board</Link>
      </div>

      <h1 style={{ marginBottom: 4 }}>Data sync check</h1>
      <div className="subline" style={{ marginBottom: 16, lineHeight: 1.5 }}>
        This reads straight from the database, bypassing everything else -
        no caching, no stored state. If two people open this page and see a
        different <b>fingerprint</b>, one of them is genuinely looking at
        different data (not just a rendering difference). If the
        fingerprints match, both devices are in sync even if something on
        screen looks off for another reason.
      </div>

      <button className="add-btn-inline" onClick={() => load()} disabled={loading} style={{ marginBottom: 20 }}>
        {loading ? "Checking…" : "Check again"}
      </button>

      <div style={{ marginBottom: 20 }}>
        <div className="subline" style={{ marginBottom: 6 }}>Look up a specific player's raw bet records</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="e.g. Aberg"
            value={playerQuery}
            onChange={(e) => setPlayerQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            style={{
              flex: 1, background: "rgba(0,0,0,0.25)", border: "1px solid var(--line)", color: "var(--cream)",
              fontFamily: "'JetBrains Mono',monospace", fontSize: 13, padding: "8px 10px", borderRadius: 3,
            }}
          />
          <button className="add-btn-inline" onClick={() => load()}>Search</button>
        </div>
      </div>

      {data?.matches && (
        <div style={{ marginBottom: 20 }}>
          <div className="subline" style={{ marginBottom: 8 }}>
            {data.matches.length} match(es)
          </div>
          {data.matches.length === 0 && (
            <div className="card" style={{ padding: 14, color: "var(--clay)" }}>
              No bet found for that name anywhere in the live or archived data - it genuinely
              doesn't exist in the database right now, not just a display issue.
            </div>
          )}
          {data.matches.map((m) => (
            <div key={m.id} className="card" style={{ marginBottom: 8, padding: 14, fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{m.player} · {m.bet}</div>
              <div style={{ color: "var(--cream-dim)", marginBottom: 6 }}>{m.t} · {m.r} · {m.personal ? "personal" : "regular"}</div>
              <div>status: <b>{m.status}</b></div>
              <div>loadedDate: <b>{m.loadedDate ?? "(not set)"}</b></div>
              <div>archivedAt: <b>{m.archivedAt ?? "(not archived - still live)"}</b></div>
              <div>in live array: <b>{m.inLiveArray ? "yes" : "no"}</b> · in archive array: <b>{m.inArchiveArray ? "yes" : "no"}</b></div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="card" style={{ marginBottom: 16, padding: 14 }}>
            <div className="subline" style={{ marginBottom: 6 }}>Fingerprint</div>
            <div style={{
              fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700,
              color: "var(--gold-bright)", letterSpacing: "0.04em", wordBreak: "break-all",
            }}>
              {data.fingerprint}
            </div>
            <div className="subline" style={{ marginTop: 8 }}>
              Checked at {new Date(data.generatedAt).toLocaleTimeString()} · {data.totalBets} total bets
              ({data.betsInProgress} live, {data.betsArchived} archived)
            </div>
          </div>

          <div className="subline" style={{ marginBottom: 8 }}>By tournament / round</div>
          {Object.entries(data.byTournamentRound).map(([key, g]) => (
            <div key={key} className="card" style={{ marginBottom: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>{key}</div>
              <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                <span className="tsum win">{g.wins}W</span>
                <span className="tsum loss">{g.losses}L</span>
                <span className="tsum live">{g.live} live</span>
                <span style={{ color: "var(--cream-dim)" }}>{g.pending} pending</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
