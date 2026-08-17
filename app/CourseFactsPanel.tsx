"use client";

import { useState } from "react";

// Course facts from Betsperts/Ron Klos "The Rabbit Hole" at BetspertsGolf.com.
// Add a new entry here whenever you receive a course facts screenshot.
// Key must match exactly the tournament name used in Admin → Tournaments.

export type CourseFacts = {
  courseName: string;
  tournament: string;
  par: number;
  yards: number;
  courseType: string;
  architect: string;
  redesign?: string;
  lengthRank: string;
  bunkers: number;
  bunkersRank: string;
  waterHoles: number;
  waterHolesRank?: string;
  fairways: string;
  avgFairwayWidth: string;
  fairwayWidthRank: string;
  rough: string;
  greens: string;
  greensSize: string;
  greensSizeRank: string;
  greensStimpmeter: number;
  greensSpeed: string;
  scoreDifficulty: string;
  correlated: string[];
  notes?: string;
  location?: string;
  season?: string;
  eventType?: string;
  elevation?: string;
  elevationRank?: string;
  roughLength?: string;
  lengthDescriptor?: string;
};

export const COURSE_FACTS: Record<string, CourseFacts> = {
  "3M Open": {
    courseName: "TPC Twin Cities",
    tournament: "3M Open (2019-2025)",
    par: 71,
    yards: 7431,
    courseType: "Tree-lined Parkland",
    architect: "Arnold Palmer (2000)",
    redesign: "Steve Wenzloff (2018)",
    lengthRank: "10th longest/44",
    bunkers: 72,
    bunkersRank: "21st fewest/44",
    waterHoles: 13,
    fairways: "Bentgrass",
    avgFairwayWidth: "35.0 yds",
    fairwayWidthRank: "10th widest/44",
    rough: "Bluegrass/Fescue 4\"",
    greens: "Bentgrass",
    greensSize: "6,500 sq ft",
    greensSizeRank: "17th largest/44",
    greensStimpmeter: 12.5,
    greensSpeed: "Average",
    scoreDifficulty: "Score RTP: -0.83 · 19th toughest/44",
    correlated: ["TPC River Highlands", "TPC Sawgrass", "Detroit GC", "TPC Deere Run", "PGA National", "Pete Dye Stadium Course", "Le Golf National", "TPC Craig Ranch", "TPC Toronto"],
  },
  "Rocket Classic": {
    courseName: "Detroit Golf Club",
    tournament: "Rocket Classic (2019-2025)",
    par: 70,
    yards: 7328,
    courseType: "Tree-lined Parkland",
    architect: "Donald Ross (1916)",
    redesign: "Tyler Rae (2025)",
    lengthRank: "11th longest/45",
    bunkers: 91,
    bunkersRank: "5th most/45",
    waterHoles: 0,
    fairways: "Bent/Poa annua",
    avgFairwayWidth: "33.0 yds",
    fairwayWidthRank: "20th widest/45",
    rough: "Bluegrass mix 3.5\"",
    greens: "Poa annua (50%) / Bentgrass (50%)",
    greensSize: "6,700 sq ft",
    greensSizeRank: "15th largest/45",
    greensStimpmeter: 12,
    greensSpeed: "Average",
    scoreDifficulty: "Score RTP: +0.20 · 13th toughest/45",
    correlated: ["TPC River Highlands", "Aronimink", "TPC Deere Run", "TPC Twin Cities", "Sedgefield", "Colonial", "Silverado", "Oakdale", "Torrey Pines (North)", "TPC Toronto"],
    notes: "2026 redesign: par 72 → 70. Historical data has limited predictive value for the new setup.",
  },
  "Scottish Open": {
    courseName: "The Renaissance Club",
    tournament: "Scottish Open (2019-2025)",
    par: 70,
    yards: 7282,
    courseType: "Hybrid Links",
    architect: "Tom Doak (2008)",
    lengthRank: "16th longest/44",
    bunkers: 83,
    bunkersRank: "12th most/44",
    waterHoles: 0,
    fairways: "Fescue",
    avgFairwayWidth: "32.0 yds",
    fairwayWidthRank: "16th narrowest/44",
    rough: "Fescue 3\"-5\"",
    greens: "Fescue",
    greensSize: "7,000 sq ft",
    greensSizeRank: "10th largest/44",
    greensStimpmeter: 10,
    greensSpeed: "Slow",
    scoreDifficulty: "Score RTP: +0.04 · 13th toughest/44",
    correlated: ["Royal Portrush", "Royal Birkdale", "Royal St. George's", "Royal Troon", "Royal Liverpool", "St. Andrews", "Shinnecock Hills", "Kiawah Island", "Memorial Park", "L.A. Country Club"],
  },
  "The Open Championship": {
    courseName: "Royal Birkdale Golf Club",
    tournament: "Open Championship (10 times)",
    par: 70,
    yards: 7223,
    courseType: "Ocean Links",
    architect: "Fred Hawtree / J.H. Taylor (1935)",
    redesign: "Tom Mackenzie (2025)",
    lengthRank: "20th shortest/44",
    bunkers: 110,
    bunkersRank: "2nd most/44",
    waterHoles: 1,
    fairways: "Fescue/Bent",
    avgFairwayWidth: "32.0 yds",
    fairwayWidthRank: "14th narrowest/44",
    rough: "Native/Fescue 4-6\"",
    greens: "Fescue/Bent",
    greensSize: "5,500 sq ft",
    greensSizeRank: "12th smallest/44",
    greensStimpmeter: 10.5,
    greensSpeed: "Slow",
    scoreDifficulty: "Score RTP: +1.85 (2017) · 11th hardest major since 2015",
    correlated: ["Royal Liverpool", "Royal Troon", "Royal St. George's", "Carnoustie", "The Renaissance Club", "St. Andrews (Old Course)", "Royal Portrush", "Shinnecock Hills", "Kiawah Island", "Erin Hills"],
  },
  "Wyndham Championship": {
    courseName: "Sedgefield Country Club",
    tournament: "Wyndham Championship (2008-2025)",
    par: 70,
    yards: 7131,
    courseType: "Tree-lined Parkland",
    architect: "Donald Ross (1926)",
    redesign: "Kris Spence (2007)",
    lengthRank: "19th shortest/44",
    bunkers: 52,
    bunkersRank: "7th fewest/44",
    waterHoles: 6,
    fairways: "Bermuda",
    avgFairwayWidth: "29.0 yds",
    fairwayWidthRank: "9th narrowest/44",
    rough: "Bermuda 2.5\"",
    greens: "Bermuda",
    greensSize: "6,000 sq ft",
    greensSizeRank: "18th smallest/44",
    greensStimpmeter: 12.5,
    greensSpeed: "Fast",
    scoreDifficulty: "Score RTP: -0.85 · 20th toughest/44",
    correlated: ["Detroit GC", "TPC River Highlands", "Colonial CC", "Waialae CC", "TPC Potomac", "TPC Sawgrass", "Sea Island (Seaside)", "Innisbrook", "Harbour Town"],
    location: "North Carolina / Southeast",
    season: "Summer",
    eventType: "36-hole Cut / Full Field",
    elevation: "830 feet",
    elevationRank: "7th highest/44",
    roughLength: "Average",
    lengthDescriptor: "Average (101.9 yds/par)",
  },
  "FedEx St. Jude Championship": {
    courseName: "TPC Southwind",
    tournament: "FedEx St. Jude Championship (1989-2025)",
    par: 70,
    yards: 7288,
    courseType: "Tree-lined Parkland",
    architect: "Ron Pritchard (1988)",
    redesign: "2024-2025 renovation",
    lengthRank: "13th longest/44",
    bunkers: 75,
    bunkersRank: "21st most/44",
    waterHoles: 11,
    waterHolesRank: "7th most/44",
    fairways: "Zoysia",
    avgFairwayWidth: "28.0 yds",
    fairwayWidthRank: "7th narrowest/44",
    rough: "Bermuda 3\"",
    greens: "Bermuda",
    greensSize: "4,500 sq ft",
    greensSizeRank: "3rd smallest/44",
    greensStimpmeter: 12,
    greensSpeed: "Average",
    scoreDifficulty: "Score RTP: -1.02 · 20th easiest/44",
    correlated: ["TPC Sawgrass", "PGA National", "Innisbrook", "East Lake", "CC of Jackson", "Sedgefield CC", "Sea Island (Plantation)", "Waialae CC", "Colonial CC", "TPC River Highlands"],
    location: "Tennessee / Southeast",
    season: "FedExCup Playoffs",
    eventType: "No-Cut / Small Field / Playoffs",
    elevation: "350 feet",
    elevationRank: "18th highest/44",
    roughLength: "Average",
    lengthDescriptor: "Average (104.1 yds/par)",
  },
  "BMW Championship": {
    courseName: "Bellerive Country Club",
    tournament: "BMW Championship",
    par: 70,
    yards: 7448,
    courseType: "Tree-lined Parkland",
    architect: "Robert Trent Jones (1960)",
    redesign: "Rees Jones (2006, 2019)",
    lengthRank: "6th longest/44",
    bunkers: 76,
    bunkersRank: "20th most/44",
    waterHoles: 8,
    waterHolesRank: "13th most/44",
    fairways: "Zoysia",
    avgFairwayWidth: "34.0 yds",
    fairwayWidthRank: "21st narrowest/44",
    rough: "Fescue 3\"",
    greens: "Bent",
    greensSize: "7,500 sq ft",
    greensSizeRank: "3rd largest/44",
    greensStimpmeter: 11.5,
    greensSpeed: "Slow",
    scoreDifficulty: "Score RTP: +0.11 · 13th toughest/44",
    correlated: ["TPC Southwind", "TPC Craig Ranch", "Colonial CC", "East Lake GC", "Quail Hollow", "Bay Hill", "Valhalla GC", "Muirfield Village", "Southern Hills CC"],
    location: "Missouri / Midwest",
    season: "FedExCup Playoffs",
    eventType: "No-Cut / Small Field / Playoffs",
    elevation: "530 feet",
    elevationRank: "15th highest/44",
    roughLength: "Average",
    lengthDescriptor: "Long (106.4 yds/par)",
  },
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 11 }}>
      <span style={{ color: "var(--cream-dim)" }}>{label}</span>
      <span style={{ color: "var(--cream)", textAlign: "right", maxWidth: "55%" }}>{value}</span>
    </div>
  );
}

export default function CourseFactsPanel({ tournamentName }: { tournamentName: string }) {
  const f = COURSE_FACTS[tournamentName];
  const [expanded, setExpanded] = useState(false);
  if (!f) return null;

  return (
    <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <span
        className="subline"
        style={{ marginBottom: 8, display: "block", cursor: "pointer" }}
        onClick={() => setExpanded((e) => !e)}
      >
        Course facts · {f.courseName} {expanded ? "▾" : "▸"}
      </span>

      {expanded && (
        <>
          {f.notes && (
            <div style={{ fontSize: 11, color: "var(--gold-bright)", marginBottom: 10, lineHeight: 1.5 }}>
              ⚠ {f.notes}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div>
              {f.location && <Stat label="Location" value={f.location} />}
              {f.season && <Stat label="Season" value={f.season} />}
              {f.eventType && <Stat label="Event type" value={f.eventType} />}
              <Stat label="Par / Yards" value={`Par ${f.par} · ${f.yards.toLocaleString()} yds`} />
              <Stat label="Course type" value={f.courseType} />
              <Stat label="Architect" value={f.architect} />
              {f.redesign && <Stat label="Redesign" value={f.redesign} />}
              <Stat label="Length rank" value={f.lengthDescriptor ? `${f.lengthDescriptor} (${f.lengthRank})` : f.lengthRank} />
              {f.elevation && <Stat label="Elevation" value={f.elevationRank ? `${f.elevation} (${f.elevationRank})` : f.elevation} />}
              <Stat label="Bunkers" value={`${f.bunkers} (${f.bunkersRank})`} />
              <Stat label="Water holes" value={f.waterHoles === 0 ? "None" : f.waterHolesRank ? `${f.waterHoles} (${f.waterHolesRank})` : String(f.waterHoles)} />
              <Stat label="Difficulty" value={f.scoreDifficulty} />
            </div>
            <div>
              <Stat label="Fairways" value={f.fairways} />
              <Stat label="Fairway width" value={`${f.avgFairwayWidth} (${f.fairwayWidthRank})`} />
              <Stat label="Rough" value={f.roughLength ? `${f.rough} · ${f.roughLength} length` : f.rough} />
              <Stat label="Greens" value={f.greens} />
              <Stat label="Greens size" value={`${f.greensSize} (${f.greensSizeRank})`} />
              <Stat label="Stimpmeter" value={f.greensStimpmeter} />
              <Stat label="Greens speed" value={f.greensSpeed} />
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 11 }}>
            <span style={{ color: "var(--cream-dim)" }}>Correlated courses: </span>
            <span style={{ color: "var(--cream)" }}>{f.correlated.join(", ")}</span>
          </div>
        </>
      )}
    </div>
  );
}
