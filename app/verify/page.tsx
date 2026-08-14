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
};

export default function VerifyPage() {
  const [data, setData] = useState<VerifyData | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetchFresh("/api/verify")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

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

      <button className="add-btn-inline" onClick={load} disabled={loading} style={{ marginBottom: 20 }}>
        {loading ? "Checking…" : "Check again"}
      </button>

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
