/**
 * ThemeManager
 * Evaluates preloaded theme definitions and automatically activates the right
 * theme based on:
 *  1. Current date / Hijri date (highest priority)
 *  2. Current weather code
 *
 * Theme data is injected via constructor options (preloaded by DataLoader)
 * instead of being fetched internally.
 *
 * Dev shortcut: Alt+T — opens theme selector popup (only if devMode.theme is true).
 */
import { ThemeEffectsManager } from './theme-effects.js';

export class ThemeManager {
  /**
   * @param {BackgroundManager} bgManager
   * @param {object} [opts]
   * @param {Array}    [opts.themes=[]]       - preloaded themes array from DataLoader
   * @param {boolean}  [opts.devMode=true]
   * @param {function} [opts.onGreetingChange] - called with (text|null) when a theme greeting changes
   */
  constructor(bgManager, opts = {}) {
    this._bg               = bgManager;
    this._themes           = Array.isArray(opts.themes) ? opts.themes : [];
    this._active           = null;
    this._effects          = null;
    this._weatherCode      = null;
    this._devMode          = opts.devMode ?? true;
    this._onGreetingChange = opts.onGreetingChange ?? null;
  }

  /**
   * Initialize the effects engine and apply the appropriate theme.
   * No longer async — theme definitions are injected via constructor opts.
   * Call setWeatherCode() any time after init() to trigger re-evaluation.
   */
  init() {
    /* Init effects engine */
    const canvas = document.getElementById('effects-canvas');
    if (canvas) {
      this._effects = new ThemeEffectsManager(canvas);
    }

    /* Apply theme using any weather code already received */
    this._evaluate(this._weatherCode);

    /* Dev shortcut: Alt+T — open theme selector popup (only if devMode enabled) */
    if (this._devMode) {
      document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 't') {
          e.preventDefault();
          this._showDevPopup();
        }
      });
    }
  }

  /**
   * Notify ThemeManager of the current weather code.
   * Called by WeatherManager after it finishes loading.
   * Date-based themes are not overridden by weather themes.
   * @param {number} code - BMKG weather code
   */
  setWeatherCode(code) {
    this._weatherCode = code;
    /* Don't override an active date theme */
    if (this._active?.trigger?.type === 'date') return;
    this._evaluate(code);
  }

  /* ---- Private ---- */

  /**
   * Determine and apply the best matching theme.
   * Priority: date events > weather themes > no theme.
   * @param {number|null} weatherCode
   */
  _evaluate(weatherCode) {
    const now = new Date();

    /* 1. Check date-based & hijri-based themes first (higher priority) */
    const dateTheme = this._themes
      .filter(t => t.enabled && (t.trigger?.type === 'date' || t.trigger?.type === 'hijri'))
      .find(t => {
        if (t.trigger.type === 'date')  return this._matchesDate(now, t.trigger);
        if (t.trigger.type === 'hijri') return this._matchesHijriDate(now, t.trigger);
        return false;
      });

    if (dateTheme) { this._apply(dateTheme); return; }

    /* 2. Check weather-based themes */
    if (weatherCode !== null && weatherCode !== undefined) {
      const weatherTheme = this._themes
        .filter(t => t.enabled && t.trigger?.type === 'weather')
        .find(t => t.trigger.codes?.includes(weatherCode));

      if (weatherTheme) { this._apply(weatherTheme); return; }
    }

    /* 3. No theme matches — clear */
    this._clear();
  }

  /**
   * Check if a date trigger matches "now" (within ±rangeDays).
   * Handles year-boundary wrap (e.g. New Year spanning Dec → Jan).
   * @param {Date} now
   * @param {{ month: number, day: number, rangeDays: number }} trigger
   * @returns {boolean}
   */
  _matchesDate(now, trigger) {
    const { month, day, rangeDays = 0 } = trigger;
    const msPerDay = 1000 * 60 * 60 * 24;
    for (const year of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
      const target   = new Date(year, month - 1, day);
      const diffDays = (now - target) / msPerDay;
      if (diffDays >= -rangeDays && diffDays <= rangeDays) return true;
    }
    return false;
  }

  /**
   * Convert a Gregorian Date to Hijri (tabular Islamic calendar).
   * May differ ±1-2 days from the observed/official Islamic calendar.
   * @param {Date} date
   * @returns {{ year: number, month: number, day: number }}
   */
  _toHijri(date) {
    const jd  = Math.floor(date.getTime() / 86400000 + 2440587.5 + 0.5);
    const l   = jd - 1948440 + 10632;
    const n   = Math.floor((l - 1) / 10631);
    const l2  = l - 10631 * n + 354;
    const j   = (Math.floor((10985 - l2) / 5316)) * (Math.floor((50 * l2) / 17719)) +
                (Math.floor(l2 / 5670)) * (Math.floor((43 * l2) / 15238));
    const l3  = l2 - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) -
                (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
    return {
      year:  30 * n + j - 30,
      month: Math.floor((24 * l3) / 709),
      day:   l3 - Math.floor((709 * Math.floor((24 * l3) / 709)) / 24),
    };
  }

  /**
   * Check if today is within ±rangeDays of a Hijri calendar date.
   * Iterates through a window of days for accuracy.
   * @param {Date} now
   * @param {{ month: number, day: number, rangeDays: number }} trigger
   * @returns {boolean}
   */
  _matchesHijriDate(now, trigger) {
    const { month, day, rangeDays = 0 } = trigger;
    const msPerDay = 86400000;
    for (let offset = -rangeDays; offset <= rangeDays; offset++) {
      const h = this._toHijri(new Date(now.getTime() + offset * msPerDay));
      if (h.month === month && h.day === day) return true;
    }
    return false;
  }

  /**
   * Apply a theme: add body class, set background override, start effects.
   * @param {object} theme
   */
  _apply(theme) {
    if (this._active?.id === theme.id) return; // already active
    this._clear(false);
    this._active = theme;

    /* CSS body class */
    if (theme.bodyClass) document.body.classList.add(theme.bodyClass);

    /* Background gradient */
    if (theme.background) this._bg.setOverride(theme.background);

    /* Particle / visual effects */
    if (theme.effects?.length && this._effects) {
      this._effects.start(theme.effects);
    }

    /* Notify greeting manager */
    if (this._onGreetingChange && theme.greeting) {
      /* greetingName overrides {name} for specific-person themes (e.g. birthday-yoga) */
      const greetingText = theme.greetingName
        ? theme.greeting.replace(/{name}/g, theme.greetingName)
        : theme.greeting;
      this._onGreetingChange(greetingText);
    } else if (this._onGreetingChange) {
      this._onGreetingChange(null); // clear override
    }

    console.info(`[ThemeManager] Theme active: "${theme.name}"`);
  }

  /**
   * Deactivate current theme: remove body class, clear background, stop effects.
   * @param {boolean} [log=true]
   */
  _clear(log = true) {
    if (!this._active) return;
    if (this._active.bodyClass) document.body.classList.remove(this._active.bodyClass);
    this._bg.clearOverride();
    this._effects?.stop();
    if (log) console.info(`[ThemeManager] Theme cleared: "${this._active.name}"`);
    this._active = null;

    /* Notify greeting manager to restore normal greeting */
    if (this._onGreetingChange) this._onGreetingChange(null);
  }

  /**
   * Dev tool: open a popup to pick a theme (Alt+T).
   */
  _showDevPopup() {
    const existing = document.getElementById('theme-dev-popup');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'theme-dev-popup';

    const TRIGGER_LABELS = { date: '📅 Date', weather: '🌤 Weather', hijri: '🌙 Hijri' };

    const allItems = [
      { id: 'none', name: 'No Theme', trigger: null, enabled: true },
      ...this._themes.map(t => ({
        id:      t.id,
        name:    t.name,
        trigger: t.trigger?.type ?? null,
        enabled: t.enabled,
      })),
    ];

    const activeId = this._active?.id ?? 'none';
    let focusIdx   = Math.max(0, allItems.findIndex(i => i.id === activeId));

    overlay.innerHTML = `
      <div id="theme-dev-panel">
        <div id="theme-dev-header">
          <span id="theme-dev-title">🎨 Dev Theme Selector</span>
          <button id="theme-dev-close" aria-label="Close">✕</button>
        </div>
        <p id="theme-dev-hint">Alt+T to toggle · ↑↓ navigate · Enter select · Esc close</p>
        <ul id="theme-dev-list">
          ${allItems.map(item => `
            <li
              class="theme-dev-item${item.id === activeId ? ' theme-dev-item--active' : ''}${!item.enabled ? ' theme-dev-item--disabled' : ''}"
              data-id="${item.id}"
              title="${!item.enabled ? 'Disabled in themes.json' : ''}"
            >
              <span class="theme-dev-item-name">${item.name}</span>
              ${item.trigger ? `<span class="theme-dev-badge">${TRIGGER_LABELS[item.trigger] ?? item.trigger}</span>` : ''}
              ${item.id === activeId ? '<span class="theme-dev-check">✓</span>' : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#theme-dev-close').addEventListener('click', close);

    const getItems = () => [...overlay.querySelectorAll('.theme-dev-item')];

    const applyItem = (id) => {
      if (id === 'none') {
        this._clear(false);
      } else {
        const theme = this._themes.find(t => t.id === id);
        if (theme) { this._apply(theme); }
      }
      close();
    };

    /* Click to select */
    getItems().forEach(el => el.addEventListener('click', () => applyItem(el.dataset.id)));

    /* Arrow key focus highlight */
    const setFocus = (idx) => {
      focusIdx = ((idx % allItems.length) + allItems.length) % allItems.length;
      getItems().forEach((el, i) => el.classList.toggle('theme-dev-item--focused', i === focusIdx));
      getItems()[focusIdx]?.scrollIntoView({ block: 'nearest' });
    };

    const onKey = (e) => {
      if (e.key === 'Escape')    { close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(focusIdx + 1); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setFocus(focusIdx - 1); return; }
      if (e.key === 'Enter') {
        const item = allItems[focusIdx];
        if (item) { applyItem(item.id); }
      }
    };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('theme-dev-popup--visible');
      setFocus(focusIdx);
    });
  }
}
