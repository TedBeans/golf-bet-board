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
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="player" style={{ fontSize: 15 }}>{name}</div>
      <div className="subline" style={{ marginTop: 2, textTransform: "none", letterSpacing: 0 }}>
        {[meta.dateRange, meta.venue, meta.location].filter(Boolean).join(" · ")}
      </div>

      {meta.notes && (
        <div style={{ fontSize: 12, color: "var(--cream-dim)", marginTop: 8, lineHeight: 1.5 }}>{meta.notes}</div>
      )}

      {meta.latitude !== undefined && meta.longitude !== undefined && (
        <div style={{ marginTop: 10 }}>
          <div className="subline" style={{ marginBottom: 6 }}>Projected weather</div>
          <WeatherStrip latitude={meta.latitude} longitude={meta.longitude} startDate={meta.startDate} endDate={meta.endDate} />
        </div>
      )}
    </div>
  );
}
