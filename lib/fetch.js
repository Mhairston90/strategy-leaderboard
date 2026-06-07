const SHEET_BASE = 'https://script.google.com/macros/s/AKfycbyVLBnBLtremcupVRW-9B7a9tST7CpjTZQPr8OWxeGvMfs17Md53u01yFks8Y4uQ4ny/exec';
const BULL_RAW_BASE = 'https://raw.githubusercontent.com/Mhairston90/trading-bull/refs/heads/main';

const DEFAULT_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, timeout = DEFAULT_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return res;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Convert a raw doGet() response (from Sheets or test fixture) into the
 * normalized shape adapters consume: { ok, rows, headers, error? }.
 *
 * Exported so adapter tests can normalize raw fixture JSON the same way.
 */
export function normalizeSheetResponse(raw) {
  if (raw && raw.status === 'ok') {
    return {
      ok: true,
      tab: raw.tab,
      rows: raw.rows || [],
      headers: raw.headers || [],
    };
  }
  return {
    ok: false,
    tab: raw?.tab,
    rows: [],
    headers: [],
    error: raw?.message || 'doGet returned non-ok',
  };
}

// In the browser we cannot fetch the Apps Script / GitHub endpoints directly:
// Apps Script /exec 302-redirects without a CORS Access-Control-Allow-Origin
// header, so the browser blocks it on the redirect hop (this is why the rows
// showed ERROR in the dashboard while the Node smoke test — which doesn't
// enforce CORS — passed). Route browser fetches through the same-origin proxy
// served by scripts/serve_leaderboard.py. Node (smoke/tests) has no CORS and
// no proxy running, so it keeps hitting the external URLs directly.
const IS_BROWSER = typeof window !== 'undefined';

/**
 * Fetch a Sheets tab. Returns { ok, tab, rows, headers, error? }.
 */
export async function fetchSheetTab(tab, limit = 200) {
  const url = IS_BROWSER
    ? `/proxy/sheet?tab=${encodeURIComponent(tab)}&limit=${limit}`
    : `${SHEET_BASE}?tab=${encodeURIComponent(tab)}&limit=${limit}`;
  try {
    const res = await fetchWithTimeout(url);
    const data = await res.json();
    return normalizeSheetResponse(data);
  } catch (e) {
    return { ok: false, tab, rows: [], headers: [], error: e.message };
  }
}

/**
 * Fetch a BULL repo file (markdown). Returns { ok, path, text, error? }.
 */
export async function fetchBullFile(relPath) {
  const url = IS_BROWSER
    ? `/proxy/bull?path=${encodeURIComponent(relPath)}`
    : `${BULL_RAW_BASE}/${relPath}`;
  try {
    const res = await fetchWithTimeout(url);
    const text = await res.text();
    return { ok: true, path: relPath, text };
  } catch (e) {
    return { ok: false, path: relPath, text: '', error: e.message };
  }
}

/**
 * Fetch a local repo file from the browser. Returns { ok, path, text, error? }.
 */
export async function fetchLocalText(relPath) {
  try {
    if (typeof window === 'undefined') {
      const fs = await import('node:fs/promises');
      const url = await import('node:url');
      const path = await import('node:path');
      const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
      const target = path.resolve(repoRoot, relPath);
      if (target !== repoRoot && !target.startsWith(repoRoot + path.sep)) {
        throw new Error('local path escapes repo root');
      }
      const text = await fs.readFile(target, 'utf8');
      return { ok: true, path: relPath, text };
    }
    const res = await fetchWithTimeout(relPath);
    const text = await res.text();
    return { ok: true, path: relPath, text };
  } catch (e) {
    return { ok: false, path: relPath, text: '', error: e.message };
  }
}
