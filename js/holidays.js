/**
 * HolidayManager
 *
 * Fetches Indonesian public holidays from date.nager.at (free, no API key).
 * Caches in localStorage (keyed by year). On load checks cache validity.
 * Merges national holidays with special dates from config (birthdays etc).
 * Renders a sidebar widget showing:
 *  - Upcoming events with H-X countdown (only for events ≤ 7 days away)
 *  - Full list of events this month
 *
 * API: https://date.nager.at/api/v3/PublicHolidays/{year}/ID
 */
export class HolidayManager {
  /**
   * @param {HTMLElement} cardEl - the #holiday-card element
   * @param {object} config - app config (uses config.specialDates)
   */
  constructor(cardEl, config) {
    this._el = cardEl;
    this._config = config;
    this._events = [];          // merged & sorted list
  }

  async init() {
    this._events = await this._loadEvents();
    this._render();
  }

  /* ── Data loading ── */

  async _loadEvents() {
    const year = new Date().getFullYear();
    const cacheKey = `holidays_${year}`;
    let holidays = [];

    /* 1. Try localStorage cache */
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) ?? 'null');
      if (cached?.year === year && Array.isArray(cached.holidays)) {
        holidays = cached.holidays;
      }
    } catch { /* ignore */ }

    /* 2. Fetch from API if cache miss */
    if (!holidays.length) {
      try {
        const res = await fetch(
          `https://date.nager.at/api/v3/PublicHolidays/${year}/ID`,
          { cache: 'default' }
        );
        if (res.ok) {
          const data = await res.json();
          holidays = data.map(h => ({
            date: h.date,
            name: h.localName || h.name,
            type: 'national',
          }));
          localStorage.setItem(cacheKey, JSON.stringify({ year, holidays }));
        }
      } catch (err) {
        console.warn('[HolidayManager] API fetch failed:', err);
      }
    }

    return this._mergeSpecialDates(holidays, year);
  }

  /**
   * Merge national holidays with config.specialDates (birthdays etc).
   * Special dates override matching national holidays by date.
   */
  _mergeSpecialDates(holidays, year) {
    const specials = (this._config.specialDates ?? []).map(s => ({
      date: `${year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`,
      name: s.label,
      type: 'special',
    }));

    /* Merge: if a national holiday lands on the same date as a special, keep both */
    const merged = [...holidays, ...specials];
    merged.sort((a, b) => a.date.localeCompare(b.date));
    return merged;
  }

  /* ── Rendering ── */

  _render() {
    if (!this._el) return;

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthPfx = `${year}-${month}`;

    /* Events this month */
    const thisMonth = this._events.filter(e => e.date.startsWith(monthPfx));

    /* Upcoming within 7 days (including today) */
    const upcoming = this._events.filter(e => {
      if (e.date < today) return false;
      const diffMs = new Date(e.date).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0);
      const diffDays = Math.round(diffMs / 86400000);
      return diffDays <= 7;
    });

    const monthLabel = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

    let html = `<div class="holiday-header">📅 ${monthLabel}</div>`;

    /* Countdown section */
    if (upcoming.length) {
      html += `<div class="holiday-countdown-section">`;
      for (const ev of upcoming) {
        const diffDays = Math.round(
          (new Date(ev.date).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) / 86400000
        );
        const badge = diffDays === 0 ? 'Hari ini' : `H-${diffDays}`;
        const isSpecial = ev.type === 'special';
        html += `
          <div class="holiday-countdown-item${isSpecial ? ' holiday-countdown-special' : ''}">
            <span class="holiday-countdown-badge">${badge}</span>
            <span class="holiday-ev-name">${ev.name}</span>
          </div>`;
      }
      html += `</div><div class="holiday-divider"></div>`;
    }

    /* This month list */
    if (thisMonth.length) {
      html += `<ul class="holiday-list">`;
      for (const ev of thisMonth) {
        const d = new Date(`${ev.date}T00:00:00`);
        const dayNum = d.getDate();
        const dayName = d.toLocaleString('id-ID', { weekday: 'short' });
        const isPast = ev.date < today;
        html += `
          <li class="holiday-item${isPast ? ' holiday-item--past' : ''}${ev.type === 'special' ? ' holiday-item--special' : ''}">
            <span class="holiday-item-date">${dayNum} ${dayName}</span>
            <span class="holiday-item-name">${ev.name}</span>
          </li>`;
      }
      html += `</ul>`;
    } else {
      html += `<p class="holiday-empty">Tidak ada hari libur bulan ini 🎉</p>`;
    }

    this._el.innerHTML = html;
    this._el.classList.add('loaded');
  }
}
