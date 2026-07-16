/**
 * DataLoader
 *
 * Centralized data fetching layer for the Couple StartPage.
 * Abstracts the difference between website mode and Chrome Extension mode.
 *
 * ── How it works ──────────────────────────────────────────────────────────
 *
 *  Website mode  (served from a web server / Vercel):
 *    1. fetch('data/xxx.json')    — relative path, fast
 *    2. localStorage cache        — offline fallback
 *    3. Hardcoded defaults        — last resort
 *
 *  Extension mode  (chrome-extension://... New Tab):
 *    1. jsDelivr CDN fetch        — GitHub content via global CDN
 *       https://cdn.jsdelivr.net/gh/rdtyaaa/couple-startpage@main/data/xxx.json
 *    2. localStorage cache        — offline fallback
 *    3. Hardcoded defaults        — last resort
 *
 * ── Cache TTL ─────────────────────────────────────────────────────────────
 *  After a successful remote fetch the result is stored in localStorage so
 *  the next load (or an offline session) still works without expiry.
 *
 * ── Logging ───────────────────────────────────────────────────────────────
 *  All significant events are logged with a [DataLoader] prefix to the
 *  browser console to simplify debugging.
 */

import { StorageManager } from './storage.js';

/* ── Constants ──────────────────────────────────────────────────────────── */

const GITHUB_USER = 'rdtyaaa';
const GITHUB_REPO = 'couple-startpage';
const GITHUB_BRANCH = 'master';

/** jsDelivr CDN base URL for GitHub raw content */
const JSDELIVR_BASE =
  `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${GITHUB_BRANCH}`;

/* ── Hardcoded fallback defaults ────────────────────────────────────────── */
/* Used only when both remote fetch AND localStorage cache fail.             */

const DEFAULTS = {
  'config.json': {
    name: 'User',
    theme: 'dark',
    searchEngine: 'google',
    adm4: '31.71.01.1001',
    devMode: { theme: false, greeting: false },
    names: ['User'],
    specialDates: [],
  },
  'greetings.json': [],
  'letters.json': [],
  'quicklinks.json': [],
  'themes.json': { themes: [] },
  'holidays.json': { year: null, fetchedAt: null, holidays: [] },
  'market.json': {},
};

/* ── DataLoader class ───────────────────────────────────────────────────── */

export class DataLoader {
  /**
   * @param {StorageManager} [storage] - optional; created internally if omitted
   */
  constructor(storage) {
    this._storage = storage ?? new StorageManager('homepage');
  }

  /* ── Environment detection ── */

  /**
   * Returns true when running inside a Chrome Extension context.
   * Checks for the presence of the chrome.runtime API and a valid extension ID.
   * @returns {boolean}
   */
  get isExtension() {
    return (
      typeof chrome !== 'undefined' &&
      typeof chrome.runtime !== 'undefined' &&
      Boolean(chrome.runtime.id)
    );
  }

  /**
   * Base URL for remote data files (jsDelivr CDN pointing to GitHub repo).
   * Always used in extension mode; also used as fallback in website mode.
   * @returns {string}
   */
  get remoteBase() {
    return JSDELIVR_BASE;
  }

  /**
   * Absolute URL to the assets directory on jsDelivr.
   * Used by QuickLinksManager to resolve relative icon paths in extension mode.
   * @returns {string}
   */
  get remoteAssetsBase() {
    return `${JSDELIVR_BASE}/assets`;
  }

  /* ── Public API ── */

  /**
   * Load a single JSON file by filename (e.g. 'config.json').
   *
   * Fallback chain:
   *  1. Remote fetch (local relative path or jsDelivr CDN)
   *  2. localStorage cache (any age — offline safety net)
   *  3. Hardcoded defaults
   *
   * @param {string} filename  - e.g. 'config.json'
   * @returns {Promise<*>}
   */
  async load(filename) {
    const cacheKey = `cache:${filename}`;

    /* ── 1. Background fetch (Stale-While-Revalidate) ── */
    const fetchPromise = this._fetchRemote(filename)
      .then(data => {
        this._storage.setCache(cacheKey, data);
        return data;
      })
      .catch(err => {
        console.warn(`[DataLoader] Background fetch failed for ${filename}:`, err.message ?? err);
        throw err;
      });

    /* ── 2. Check localStorage cache for instant load ── */
    const cached = this._storage.getCache(cacheKey);
    if (cached !== null) {
      console.info(`[DataLoader] ✓ Loaded ${filename} (cache)`);
      return cached; // Return immediately, unblocking the UI!
    }

    /* ── 3. If no cache, wait for the remote fetch ── */
    try {
      const data = await fetchPromise;
      const src = this.isExtension ? 'jsDelivr CDN' : 'local';
      console.info(`[DataLoader] ✓ Loaded ${filename} (${src})`);
      return data;
    } catch (err) {
      /* ── 4. Hardcoded defaults ── */
      const defaults = DEFAULTS[filename];
      if (defaults !== undefined) {
        console.error(
          `[DataLoader] No cache available for ${filename} — using hardcoded defaults. ` +
          'Check network connectivity or GitHub repository.',
        );
        return structuredClone(defaults);
      }
      return null;
    }
  }

  /**
   * Preload all application data files in parallel.
   * Returns a named map of { filename_without_ext → parsed data }.
   *
   * @returns {Promise<{
   *   config: object,
   *   greetings: Array,
   *   letters: Array,
   *   quicklinks: Array,
   *   themes: object,
   *   holidays: object,
   *   market: object,
   * }>}
   */
  async preloadAll() {
    const files = [
      'config.json',
      'greetings.json',
      'letters.json',
      'quicklinks.json',
      'themes.json',
      'holidays.json',
      'market.json',
    ];

    console.info('[DataLoader] Preloading all data files…');
    const results = await Promise.all(files.map((f) => this.load(f)));

    /* Map results to a named object keyed by filename without extension */
    return Object.fromEntries(
      files.map((f, i) => [f.replace('.json', ''), results[i]]),
    );
  }

  /* ── Private helpers ── */

  /**
   * Build the fetch URL for a given data filename.
   * - Extension mode  → jsDelivr CDN (absolute URL, CORS-safe)
   * - Website mode    → relative path (served by the same origin)
   *
   * @param {string} filename
   * @returns {string}
   */
  _buildUrl(filename) {
    if (this.isExtension) {
      return `${JSDELIVR_BASE}/data/${filename}`;
    }
    return `data/${filename}`;
  }

  /**
   * Fetch a JSON file from the appropriate URL and parse it.
   * Throws on network errors or non-2xx responses.
   *
   * @param {string} filename
   * @returns {Promise<*>}
   */
  async _fetchRemote(filename) {
    const url = this._buildUrl(filename);

    let response;
    try {
      /* cache: 'no-cache' ensures we always get the latest data from GitHub */
      response = await fetch(url, { cache: 'no-cache' });
    } catch (networkErr) {
      throw new Error(`Network error fetching ${url}: ${networkErr.message}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new Error(`JSON parse error for ${url}: ${parseErr.message}`);
    }

    return data;
  }
}
