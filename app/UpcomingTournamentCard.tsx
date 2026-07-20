"use client";

import WeatherStrip from "./WeatherStrip";

type TournMeta = {
  venue?: string;
  location?: string;
  dateRange?: string;
  latitude?: number;
  longitude?: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
};

export default function UpcomingTournamentCard({ name, meta }: { name: string; meta: TournMeta }) {
  return (
    <div className="card live" style={{ marginBottom: 12, padding: "16px 18px 18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Oswald',sans-serif", fontSize: 20, fontWeight: 700, color: "var(--gold-bright)" }}>
          {name}
        </span>
        <span style={{ fontSize: 11, color: "var(--cream-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Upcoming
        </span>
      </div>
      <div className="subline" style={{ marginTop: 4, textTransform: "none", letterSpacing: 0 }}>
        {[meta.dateRange, meta.venue, meta.location].filter(Boolean).join(" · ")}
      </div>

      {meta.notes && (
        <div style={{ fontSize: 12, color: "var(--cream-dim)", marginTop: 10, lineHeight: 1.5 }}>{meta.notes}</div>
      )}

      {meta.latitude !== undefined && meta.longitude !== undefined && (
        <div style={{ marginTop: 14 }}>
          <div className="subline" style={{ marginBottom: 8 }}>Projected weather</div>
          <WeatherStrip latitude={meta.latitude} longitude={meta.longitude} startDate={meta.startDate} endDate={meta.endDate} />
        </div>
      )}
    </div>
  );
}
