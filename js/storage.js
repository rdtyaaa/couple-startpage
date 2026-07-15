/**
 * StorageManager
 * Wraps localStorage for bubble seen-today tracking, future preferences,
 * and DataLoader offline cache.
 */
export class StorageManager {
  /** @param {string} prefix - namespace for storage keys */
  constructor(prefix = 'homepage') {
    this._prefix = prefix;
  }

  /**
   * Build a namespaced key.
   * @param {string} key
   * @returns {string}
   */
  _key(key) {
    return `${this._prefix}:${key}`;
  }

  /**
   * Get a value from localStorage (parsed from JSON).
   * @param {string} key
   * @param {*} fallback
   * @returns {*}
   */
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this._key(key));
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Set a value in localStorage (serialized as JSON).
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    try {
      localStorage.setItem(this._key(key), JSON.stringify(value));
    } catch {
      /* Storage full or unavailable — fail silently */
    }
  }

  /**
   * Remove a key from localStorage.
   * @param {string} key
   */
  remove(key) {
    try {
      localStorage.removeItem(this._key(key));
    } catch {
      /* fail silently */
    }
  }

  /**
   * Check if the bubble has already been shown today.
   * @returns {boolean}
   */
  hasSeenBubbleToday() {
    const lastSeen = this.get('bubble_last_seen');
    if (!lastSeen) return false;
    const today = new Date().toISOString().slice(0, 10);
    return lastSeen === today;
  }

  /**
   * Mark the bubble as seen for today.
   */
  markBubbleSeen() {
    const today = new Date().toISOString().slice(0, 10);
    this.set('bubble_last_seen', today);
  }

  /* ── DataLoader Cache ── */

  /**
   * Read a cached JSON payload. Returns null if missing or expired.
   * @param {string} key         - cache key (e.g. 'cache:config.json')
   * @param {number} [ttlMs]     - max age in ms; omit for no expiry check
   * @returns {*|null}
   */
  getCache(key, ttlMs) {
    try {
      const raw = localStorage.getItem(this._key(key));
      if (!raw) return null;
      const { data, timestamp } = JSON.parse(raw);
      if (ttlMs !== undefined && Date.now() - timestamp > ttlMs) return null;
      return data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Write a JSON payload to cache with the current timestamp.
   * @param {string} key
   * @param {*}      data
   */
  setCache(key, data) {
    try {
      localStorage.setItem(
        this._key(key),
        JSON.stringify({ data, timestamp: Date.now() }),
      );
    } catch {
      /* Storage full or unavailable — fail silently */
    }
  }

  /**
   * Remove a specific cache entry.
   * @param {string} key
   */
  clearCache(key) {
    this.remove(key);
  }
}
