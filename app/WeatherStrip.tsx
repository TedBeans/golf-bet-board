"use client";

import { useEffect, useState } from "react";

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

// Live-board tournament headers pass today's date as both start/end so the
// strip only shows the single current day rather than the whole week
// (which the pre-tournament "upcoming this week" widget still shows in
// full via the same component).
export default function WeatherStrip({
  latitude,
  longitude,
  startDate,
  endDate,
  compact,
}: {
  latitude?: number;
  longitude?: number;
  startDate?: string;
  endDate?: string;
  compact?: boolean;
}) {
  const [forecast, setForecast] = useState<DayForecast[] | null>(null);
  const [weatherError, setWeatherError] = useState(false);

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    setForecast(null);
    setWeatherError(false);
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      daily: "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max",
      timezone: "auto",
      temperature_unit: "fahrenheit",
      windspeed_unit: "mph",
      // Pinned to NOAA's GFS instead of Open-Meteo's auto-picked "best
      // match" model - the auto-pick can land on a different underlying
      // model per request and occasionally produces an outlier day (e.g.
      // a 101° spike out of nowhere) that diverges sharply from what US
      // weather apps/sites show for the same day. GFS is the standard US
      // model and tracks much closer to those.
      models: "gfs_seamless",
    });
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (!startDate || !endDate) params.set("forecast_days", "7");

    fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.daily) {
          setWeatherError(true);
          return;
        }
        // Open-Meteo only suffixes fields with the model name once you ask
        // for more than one model at a time - a single explicit model like
        // this should come back unsuffixed, same shape as an auto-picked
        // request. Falling back to the suffixed key too just in case.
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
  }, [latitude, longitude, startDate, endDate]);

  if (latitude === undefined || longitude === undefined) return null;

  if (weatherError) {
    return compact ? null : <div style={{ fontSize: 11, color: "var(--cream-dim)" }}>Couldn't load a forecast.</div>;
  }
  if (!forecast) {
    return compact ? null : <div style={{ fontSize: 11, color: "var(--cream-dim)" }}>Loading forecast…</div>;
  }

  return (
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
  );
}
