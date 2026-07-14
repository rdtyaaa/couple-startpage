/**
 * BubbleManager
 * Shows a floating iMessage-style chat bubble with timed personal messages.
 * Appears on every page load and auto-hides after 20 seconds.
 *
 * Letter schema:
 * {
 *   "id":        number,
 *   "start":     "YYYY-MM-DD",           // date range start (inclusive)
 *   "end":       "YYYY-MM-DD",           // date range end (inclusive)
 *   "startTime": "HH:MM",               // optional — time-of-day window start
 *   "endTime":   "HH:MM",               // optional — time-of-day window end
 *   "message":   "string"
 * }
 *
 * Legacy format (full ISO datetime strings) is also supported for backward
 * compatibility — if `start` or `end` contains a "T", the full datetime is used.
 */
export class BubbleManager {
  /**
   * @param {HTMLElement} messageElement - the #bubble-message element
   * @param {import('./storage.js').StorageManager} storage
   */
  constructor(messageElement, storage) {
    this._messageEl = messageElement;
    this._storage = storage;
    this._hideTimer = null;
  }

  /**
   * Initialize: load letters, check if one should be shown now.
   */
  async init() {
    try {
      const letters = await this._loadLetters();
      const active = this._findActiveLetter(letters);

      if (active) {
        this._show(active.message);
      }
    } catch {
      /* Letters unavailable — fail silently */
    }
  }

  /**
   * Load letters from letters.json.
   * @returns {Promise<Array>}
   */
  async _loadLetters() {
    const response = await fetch('data/letters.json');
    if (!response.ok) throw new Error('Failed to load letters.json');
    return response.json();
  }

  /**
   * Find a letter that is active right now.
   * Supports two formats:
   *   1. New: date-only start/end + optional startTime/endTime (HH:MM)
   *   2. Legacy: full ISO datetime strings for start/end
   *
   * @param {Array} letters
   * @returns {object|null}
   */
  _findActiveLetter(letters) {
    const now = new Date();

    for (const letter of letters) {
      const isLegacy = letter.start.includes('T') || letter.end.includes('T');

      if (isLegacy) {
        /* Legacy: plain datetime range comparison */
        const start = new Date(letter.start);
        const end   = new Date(letter.end);
        if (now >= start && now <= end) return letter;
        continue;
      }

      /* New format: check date range */
      if (!this._isDateInRange(now, letter.start, letter.end)) continue;

      /* Check optional time-of-day window */
      if (letter.startTime || letter.endTime) {
        if (!this._isTimeInRange(now, letter.startTime, letter.endTime)) continue;
      }

      return letter;
    }

    return null;
  }

  /**
   * Check if a date falls within an inclusive YYYY-MM-DD range.
   * @param {Date} now
   * @param {string} startDate - "YYYY-MM-DD"
   * @param {string} endDate   - "YYYY-MM-DD"
   * @returns {boolean}
   */
  _isDateInRange(now, startDate, endDate) {
    /* Compare as YYYY-MM-DD strings to avoid timezone issues */
    const todayStr = this._toLocalDateString(now);
    return todayStr >= startDate && todayStr <= endDate;
  }

  /**
   * Check if current time falls within a HH:MM–HH:MM range.
   * If startTime is missing, defaults to "00:00".
   * If endTime is missing, defaults to "23:59".
   * @param {Date} now
   * @param {string|undefined} startTime - "HH:MM"
   * @param {string|undefined} endTime   - "HH:MM"
   * @returns {boolean}
   */
  _isTimeInRange(now, startTime, endTime) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes   = this._parseTime(startTime ?? '00:00');
    const endMinutes     = this._parseTime(endTime   ?? '23:59');
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Parse "HH:MM" into total minutes since midnight.
   * @param {string} timeStr
   * @returns {number}
   */
  _parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  /**
   * Format a Date as a local "YYYY-MM-DD" string.
   * @param {Date} date
   * @returns {string}
   */
  _toLocalDateString(date) {
    const y  = date.getFullYear();
    const m  = String(date.getMonth() + 1).padStart(2, '0');
    const d  = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Show the bubble with a message, then auto-hide after 20 seconds.
   * @param {string} message
   */
  _show(message) {
    this._messageEl.textContent = message;

    /* Delay show slightly for entrance effect */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this._messageEl.classList.add('visible');
      });
    });

    /* Auto-hide after 20 seconds */
    this._hideTimer = setTimeout(() => this._hide(), 20000);
  }

  /**
   * Hide the bubble with fade-out animation.
   */
  _hide() {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }

    this._messageEl.classList.remove('visible');
    this._messageEl.classList.add('hiding');

    /* Remove hiding class after animation completes */
    setTimeout(() => {
      this._messageEl.classList.remove('hiding');
    }, 400);
  }
}
