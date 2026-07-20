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

function weatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

// Cool blue (<=65°) -> gold (~85°) -> clay/hot (105°+), so a scorching
// forecast day reads instantly instead of blending into the same white
// text as every other number on the card.
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function tempColor(hi: number): string {
  const STEEL: [number, number, number] = [122, 128, 135]; // var(--steel)
  const GOLD: [number, number, number] = [228, 190, 74]; // var(--gold-bright)
  const CLAY: [number, number, number] = [192, 106, 76]; // var(--clay)
  let c1: [number, number, number], c2: [number, number, number], t: number;
  if (hi <= 85) { c1 = STEEL; c2 = GOLD; t = Math.max(0, Math.min(1, (hi - 60) / 25)); }
  else { c1 = GOLD; c2 = CLAY; t = Math.max(0, Math.min(1, (hi - 85) / 20)); }
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r}, ${g}, ${b})`;
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
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
      {forecast.map((d) => (
        <div
          key={d.date}
          style={{
            minWidth: compact ? 92 : 108,
            textAlign: "center",
            padding: compact ? "8px 10px" : "12px 14px",
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "linear-gradient(180deg, rgba(228,190,74,0.05), rgba(228,190,74,0.01))",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--cream-dim)", marginBottom: 4 }}>
            {new Date(d.date + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" })}
          </div>
          <div style={{ fontSize: compact ? 22 : 28, lineHeight: 1, marginBottom: 4 }}>{weatherEmoji(d.code)}</div>
          <div style={{ fontSize: 11, color: "var(--cream)", marginBottom: 6 }}>{weatherLabel(d.code)}</div>
          <div style={{ fontSize: compact ? 18 : 22, fontWeight: 700, color: tempColor(d.hi), lineHeight: 1 }}>
            {d.hi}° <span style={{ fontSize: compact ? 12 : 14, fontWeight: 400, color: "var(--cream-dim)" }}>{d.lo}°</span>
          </div>
          <div style={{ fontSize: 10, marginTop: 6, color: d.rainChance >= 40 ? "var(--gold-bright)" : "var(--cream-dim)" }}>
            💧 {d.rainChance}%
          </div>
          <div style={{ fontSize: 10, color: "var(--cream-dim)" }}>💨 {d.windMax} mph</div>
        </div>
      ))}
    </div>
  );
}
