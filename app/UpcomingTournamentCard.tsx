"use client";

import { useEffect, useState } from "react";

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

type DayForecast = {
  date: string;
  hi: number;
  lo: number;
  rainChance: number;
  windMax: number;
  code: number;
};

function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Mostly clear";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 95) return "Storms";
  return "—";
}

export default function UpcomingTournamentCard({ name, meta }: { name: string; meta: TournMeta }) {
  const [forecast, setForecast] = useState<DayForecast[] | null>(null);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    if (meta.latitude === undefined || meta.longitude === undefined) return;
    const params = new URLSearchParams({
      latitude: String(meta.latitude),
      longitude: String(meta.longitude),
      daily: "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max",
      timezone: "auto",
      temperature_unit: "fahrenheit",
      windspeed_unit: "mph",
      // Pinned to NOAA's GFS instead of Open-Meteo's auto-picked "best
      // match" model - the auto-pick can land on a different underlying
      // model per request and occasionally produces an outlier day
      // (e.g. a 101° spike out of nowhere) that diverges sharply from
      // what US weather apps (Google, NWS, etc.) show for the same day.
      // GFS is the standard US model and tracks much closer to those.
      models: "gfs_seamless",
    });
    if (meta.startDate) params.set("start_date", meta.startDate);
    if (meta.endDate) params.set("end_date", meta.endDate);
    if (!meta.startDate || !meta.endDate) params.set("forecast_days", "7");

    fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.daily) {
          setWeatherError(true);
          return;
        }
        // Open-Meteo only suffixes fields with the model name once you ask
        // for more than one model at a time - a single explicit model like
        // this should come back unsuffixed, same shape as the old
        // auto-picked request. Falling back to the suffixed key too just
        // in case, rather than assuming and silently breaking if that
        // ever changes.
        const daily = d.daily;
        const field = (base: string) => daily[base] ?? daily[`${base}_gfs_seamless`];
        const times = daily.time;
        const tempMax = field("temperature_2m_max");
        const tempMin = field("temperature_2m_min");
        const rain = field("precipitation_probability_max");
        const wind = field("windspeed_10m_max");
        const code = field("weathercode");
        if (!times || !tempMax) {
          setWeatherError(true);
          return;
        }
        const days: DayForecast[] = times.map((date: string, i: number) => ({
          date,
          hi: Math.round(tempMax[i]),
          lo: Math.round(tempMin[i]),
          rainChance: rain[i],
          windMax: Math.round(wind[i]),
          code: code[i],
        }));
        setForecast(days);
      })
      .catch(() => setWeatherError(true));
  }, [meta.latitude, meta.longitude, meta.startDate, meta.endDate]);

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
          {weatherError && <div style={{ fontSize: 11, color: "var(--cream-dim)" }}>Couldn't load a forecast.</div>}
          {!weatherError && !forecast && <div style={{ fontSize: 11, color: "var(--cream-dim)" }}>Loading forecast…</div>}
          {forecast && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
              {forecast.map((d) => (
                <div key={d.date} style={{ minWidth: 68, textAlign: "center", fontSize: 11 }}>
                  <div style={{ color: "var(--cream-dim)", marginBottom: 2 }}>
                    {new Date(d.date + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" })}
                  </div>
                  <div style={{ color: "var(--cream)" }}>{weatherLabel(d.code)}</div>
                  <div style={{ color: "var(--cream)", fontWeight: 700 }}>{d.hi}° <span style={{ color: "var(--cream-dim)", fontWeight: 400 }}>{d.lo}°</span></div>
                  <div style={{ color: d.rainChance >= 40 ? "var(--gold-bright)" : "var(--cream-dim)" }}>{d.rainChance}% rain</div>
                  <div style={{ color: "var(--cream-dim)" }}>{d.windMax} mph wind</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
