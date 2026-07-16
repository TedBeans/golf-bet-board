// DataGolf's live-model page (datagolf.com/live-model/pga-tour) embeds its
// player prediction data (cutline %, win %, top-N %) directly in the page's
// HTML rather than exposing it via a separate fetchable JSON endpoint - the
// public page itself makes no XHR/fetch call for it (confirmed: only a GA
// beacon fires). Per-page inspection (View Page Source, not the rendered
// DOM) found the data assigned via a pattern like:
//
//   response = JSON.parse('{"ams": [...], "course": [...], ...}')
//
// i.e. a JS string literal (single-quoted, JS-escaped) that itself contains
// a JSON blob, handed straight to JSON.parse() client-side. The page has
// more than one of these calls (course/hole stats is a separate blob from
// the per-player predictions), and the exact variable name / key path
// isn't something to hang extraction logic on - it's the kind of thing
// that could get renamed in a front-end rebuild with zero notice.
//
// Instead: pull every `JSON.parse('...')` blob out of the raw HTML, parse
// each one, and recursively search the parsed result for an array of
// objects that has the shape we actually need - each per-player row from
// the predictions blob carries "dg_id", "name", and "cut" (make-cut
// probability, 0-1) among many other fields. That shape is a much more
// stable fingerprint than any specific variable name.
const DATAGOLF_URL = "https://datagolf.com/live-model/pga-tour";

export type DataGolfPlayerRow = {
  dgId: string;
  rawName: string; // as given, "Last, First"
  displayName: string; // reordered "First Last" for matching against bet.player
  lastName: string;
  currentPos: string | null;
  currentScore: number | null;
  thru: number | string | null;
  cutProb: number | null; // 0-100 (make-cut probability, %)
  winProb: number | null; // 0-100
  top5Prob: number | null;
  top10Prob: number | null;
  top20Prob: number | null;
};

// Turns a JS single-quoted string literal's raw contents (i.e. everything
// between the quotes, still containing JS escape sequences) into the
// actual string it represents. Handles \uXXXX explicitly since a naive
// single-char-after-backslash replace would otherwise mangle any escaped
// unicode (accented player names in particular) into literal "u00xx" text.
function unescapeJsStringLiteral(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === "u" && i + 5 < raw.length) {
        const hex = raw.slice(i + 2, i + 6);
        out += String.fromCharCode(parseInt(hex, 16));
        i += 5;
      } else if (next === "n") { out += "\n"; i += 1; }
      else if (next === "r") { out += "\r"; i += 1; }
      else if (next === "t") { out += "\t"; i += 1; }
      else { out += next; i += 1; } // \' \" \\ \/ and anything else -> literal char
    } else {
      out += c;
    }
  }
  return out;
}

function looksLikePredictionRow(row: any): boolean {
  return (
    row && typeof row === "object" &&
    "dg_id" in row && "name" in row &&
    ("cut" in row || "cut_start" in row)
  );
}

// Recursively walks a parsed blob looking for the array of per-player
// prediction rows, regardless of what key(s) it's nested under.
function findPredictionsArray(node: any, depth = 0): any[] | null {
  if (depth > 6 || node === null || node === undefined) return null;
  if (Array.isArray(node)) {
    if (node.length > 0 && looksLikePredictionRow(node[0])) return node;
    for (const item of node) {
      const found = findPredictionsArray(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node === "object") {
    for (const key of Object.keys(node)) {
      const found = findPredictionsArray(node[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function toDisplayName(rawName: string): { displayName: string; lastName: string } {
  const parts = rawName.split(",");
  if (parts.length >= 2) {
    const last = parts[0].trim();
    const first = parts.slice(1).join(",").trim();
    return { displayName: `${first} ${last}`.trim(), lastName: last };
  }
  return { displayName: rawName.trim(), lastName: rawName.trim() };
}

function pct(v: any): number | null {
  return typeof v === "number" && !isNaN(v) ? Math.round(v * 1000) / 10 : null; // 0-1 -> 0-100, 1dp
}

// Fetches the live-model page and extracts every player's current
// prediction row. Throws if the page structure has changed enough that no
// blob matching the expected shape can be found - callers should treat
// this as purely informational and never let a failure here block any
// actual bet grading (gradeMakeCut in betLogic.ts is entirely independent
// of this).
export async function fetchDataGolfPredictions(): Promise<DataGolfPlayerRow[]> {
  const res = await fetch(DATAGOLF_URL, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`datagolf.com fetch failed (${res.status})`);
  const html = await res.text();

  // Matches JSON.parse('...') where '...' can contain escaped chars
  // (including escaped quotes) but not a bare unescaped single quote.
  // Deliberately does NOT require the closing quote to be followed
  // immediately by ')' - the real page wraps some blobs as
  // JSON.parse('...'.replace(/\bNaN\b/g, "null")), so anything can follow
  // the closing quote.
  const blobRegex = /JSON\.parse\('((?:\\.|[^'\\])*)'/g;
  let m: RegExpExecArray | null;
  let rows: any[] | null = null;

  while ((m = blobRegex.exec(html)) !== null) {
    try {
      const jsonText = unescapeJsStringLiteral(m[1]).replace(/\bNaN\b/g, "null");
      const parsed = JSON.parse(jsonText);
      const found = findPredictionsArray(parsed);
      if (found) { rows = found; break; }
    } catch {
      // this particular blob wasn't valid/relevant JSON - keep scanning
    }
  }

  if (!rows) throw new Error("Could not locate DataGolf predictions data in page HTML - page structure may have changed");

  return rows.map((r: any) => {
    const { displayName, lastName } = toDisplayName(String(r.name || ""));
    return {
      dgId: r.dg_id != null ? String(r.dg_id) : "",
      rawName: String(r.name || ""),
      displayName,
      lastName,
      currentPos: r.current_pos != null ? String(r.current_pos) : null,
      currentScore: typeof r.current_score === "number" ? r.current_score : null,
      thru: r.thru ?? null,
      cutProb: pct(r.cut),
      winProb: pct(r.win),
      top5Prob: pct(r.top5),
      top10Prob: pct(r.top10),
      top20Prob: pct(r.top20),
    };
  });
}

// Lower-level version that never throws and returns diagnostics instead -
// used by the debug route so a failure actually shows *why* (blocked
// request, unexpected status, zero JSON.parse(...) blobs found at all,
// blobs found but none matching the expected row shape, etc) rather than
// just "didn't work". fetchDataGolfPredictions above stays throw-on-failure
// for the sync route, which only wants a clean null on any problem.
export async function fetchDataGolfDiagnostics(): Promise<{
  status: number;
  htmlLength: number;
  htmlSnippet: string;
  blobCount: number;
  blobLengths: number[];
  parseErrors: string[];
  cutlineCandidates: CutlineCandidate[];
  rows: DataGolfPlayerRow[] | null;
}> {
  const res = await fetch(DATAGOLF_URL, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  const html = await res.text();

  const blobRegex = /JSON\.parse\('((?:\\.|[^'\\])*)'/g;
  let m: RegExpExecArray | null;
  const blobLengths: number[] = [];
  const parseErrors: string[] = [];
  let rows: any[] | null = null;
  const cutlineCandidates: CutlineCandidate[] = [];

  let blobIndex = 0;
  while ((m = blobRegex.exec(html)) !== null) {
    blobLengths.push(m[1].length);
    const thisBlobIndex = blobIndex++;
    try {
      const jsonText = unescapeJsStringLiteral(m[1]).replace(/\bNaN\b/g, "null");
      const parsed = JSON.parse(jsonText);
      if (!rows) {
        const found = findPredictionsArray(parsed);
        if (found) rows = found;
      }
      collectCutlineCandidates(parsed, `blob[${thisBlobIndex}]`, 0, cutlineCandidates);
    } catch (e: any) {
      parseErrors.push(e.message || String(e));
    }
  }

  return {
    status: res.status,
    htmlLength: html.length,
    htmlSnippet: html.slice(0, 500),
    blobCount: blobLengths.length,
    blobLengths,
    parseErrors,
    cutlineCandidates,
    rows: rows
      ? rows.map((r: any) => {
          const { displayName, lastName } = toDisplayName(String(r.name || ""));
          return {
            dgId: r.dg_id != null ? String(r.dg_id) : "",
            rawName: String(r.name || ""),
            displayName,
            lastName,
            currentPos: r.current_pos != null ? String(r.current_pos) : null,
            currentScore: typeof r.current_score === "number" ? r.current_score : null,
            thru: r.thru ?? null,
            cutProb: pct(r.cut),
            winProb: pct(r.win),
            top5Prob: pct(r.top5),
            top10Prob: pct(r.top10),
            top20Prob: pct(r.top20),
          };
        })
      : null,
  };
}

// The page's "CUTLINE PROBABILITIES" widget (e.g. "+1  32.2%", "+2  40.2%",
// "+3  16.7%" - the odds the cutline itself lands at each score) is a
// different, much smaller blob than the per-player predictions array above,
// and its exact key shape hasn't been confirmed against live data yet - do
// NOT guess a fingerprint and wire it into production. Instead this walks
// every parsed blob looking for small arrays (a cutline distribution is
// only a handful of entries - one per possible cutline score) whose items
// are plain objects with a couple of numeric-ish fields, and reports them
// for a human to eyeball via /api/debug-datagolf?diag=1. Once the real
// shape is confirmed, replace this with a proper looksLikeCutlineRow()
// fingerprint the same way findPredictionsArray/looksLikePredictionRow
// works above.
export type CutlineCandidate = { path: string; length: number; sample: any };

function collectCutlineCandidates(node: any, path: string, depth: number, out: CutlineCandidate[]): void {
  if (depth > 6 || node === null || node === undefined || out.length > 25) return;
  if (Array.isArray(node)) {
    if (
      node.length > 0 &&
      node.length <= 20 &&
      typeof node[0] === "object" &&
      node[0] !== null &&
      !Array.isArray(node[0]) &&
      !looksLikePredictionRow(node[0])
    ) {
      const keys = Object.keys(node[0]);
      const numericish = keys.filter((k) => typeof node[0][k] === "number" || (typeof node[0][k] === "string" && /^-?\d/.test(node[0][k])));
      if (keys.length <= 6 && numericish.length >= 1) {
        out.push({ path, length: node.length, sample: node.slice(0, 8) });
      }
    }
    node.forEach((item, i) => collectCutlineCandidates(item, `${path}[${i}]`, depth + 1, out));
    return;
  }
  if (typeof node === "object") {
    for (const key of Object.keys(node)) {
      collectCutlineCandidates(node[key], path ? `${path}.${key}` : key, depth + 1, out);
    }
  }
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\./g, "").trim();
}

// Same exact/last-name/prefix/substring matching strategy as
// lib/pgaMatch.ts's findPlayerMatch and lib/openMatch.ts's
// findOpenPlayerMatch, adapted for DataGolf's "Last, First" source shape
// (already reordered into displayName by fetchDataGolfPredictions above).
export function findDataGolfPlayerMatch(betPlayerName: string, players: DataGolfPlayerRow[]): DataGolfPlayerRow | null {
  const target = norm(betPlayerName);
  const tokens = target.split(/\s+/);
  const lastToken = tokens[tokens.length - 1];

  let match = players.find((p) => norm(p.displayName) === target);
  if (match) return match;

  match = players.find((p) => norm(p.lastName) === lastToken);
  if (match) return match;

  match = players.find((p) => {
    const pLast = norm(p.lastName);
    return pLast.length > 2 && lastToken.length > 2 && (pLast.startsWith(lastToken) || lastToken.startsWith(pLast));
  });
  if (match) return match;

  match = players.find((p) => norm(p.displayName).includes(target) || target.includes(norm(p.lastName)));
  return match || null;
}
