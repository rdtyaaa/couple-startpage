/**
 * GreetingManager
 *
 * Priority for greeting text:
 *  1. Custom scheduled greetings from greetings.json (date + time range)
 *  2. Theme-specific greeting (set by ThemeManager when a theme activates)
 *  3. Time-of-day greeting (morning / afternoon / evening / night)
 *
 * Dev mode (Alt+C) — only name selection, controlled by config.devMode.greeting.
 * Arrow keys ↑↓ navigate the name list, Enter to apply, Esc to close.
 */
export class GreetingManager {
  /**
   * @param {HTMLElement} element - the #greeting-text element
   * @param {object} config - app config from config.json
   */
  constructor(element, config) {
    this._el              = element;
    this._name            = config.name ?? 'User';
    this._names           = config.names?.length ? config.names : [config.name ?? 'User'];
    this._devMode         = config.devMode?.greeting ?? false;

    this._themeGreeting   = null;   // text set by ThemeManager (may contain {name})
    this._customGreetings = [];     // from data/greetings.json
    this._devNameOverride = localStorage.getItem('homepage_name') ?? null;
  }

  /* ── Public ── */

  async init() {
    await this._loadCustomGreetings();
    this._render();
    if (this._devMode) this._registerShortcut();
  }

  /** Called by ThemeManager when a theme with a greeting activates. */
  setThemeGreeting(text) {
    this._themeGreeting = text;
    this._render();
  }

  /** Called by ThemeManager when the theme is cleared. */
  clearThemeGreeting() {
    this._themeGreeting = null;
    this._render();
  }

  /** Returns the current time period string. */
  getTimePeriod() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  }

  /* ── Private ── */

  async _loadCustomGreetings() {
    try {
      const res = await fetch('data/greetings.json');
      if (res.ok) this._customGreetings = await res.json();
    } catch { this._customGreetings = []; }
  }

  _currentName() {
    return this._devNameOverride ?? this._name;
  }

  _resolveGreeting() {
    /* 1. greetings.json date+time range */
    const custom = this._findActiveCustomGreeting();
    if (custom) return custom.text.replace(/{name}/g, this._currentName());

    /* 2. Theme greeting */
    if (this._themeGreeting) {
      return this._themeGreeting.replace(/{name}/g, this._currentName());
    }

    /* 3. Time-based */
    const map = {
      morning:   `Good Morning, ${this._currentName()}!`,
      afternoon: `Good Afternoon, ${this._currentName()}!`,
      evening:   `Good Evening, ${this._currentName()}!`,
      night:     `Good Night, ${this._currentName()}!`,
    };
    return map[this.getTimePeriod()];
  }

  _findActiveCustomGreeting() {
    const now     = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const hh      = String(now.getHours()).padStart(2, '0');
    const mm      = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    return this._customGreetings.find(g => {
      if (dateStr < (g.start ?? '') || dateStr > (g.end ?? '9999')) return false;
      if (g.startTime && timeStr < g.startTime) return false;
      if (g.endTime   && timeStr > g.endTime)   return false;
      return true;
    }) ?? null;
  }

  _render() {
    this._el.textContent = this._resolveGreeting();
  }

  /* ── Dev shortcut (Alt+C) — name selector ── */

  _registerShortcut() {
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        this._showNamePopup();
      }
    });
  }

  _showNamePopup() {
    const existing = document.getElementById('name-dev-popup');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'name-dev-popup';

    const currentName = this._currentName();
    let focusIdx = Math.max(0, this._names.indexOf(currentName));

    overlay.innerHTML = `
      <div id="name-dev-panel">
        <div id="name-dev-header">
          <span id="name-dev-title">👤 Dev — Pilih Nama</span>
          <button id="name-dev-close" aria-label="Close">✕</button>
        </div>
        <p id="name-dev-hint">Alt+C to toggle · ↑↓ navigate · Enter select · Esc close</p>
        <ul id="name-dev-list">
          ${this._names.map((n, i) => `
            <li class="name-dev-item${n === currentName ? ' name-dev-item--active' : ''}" data-name="${n}" data-idx="${i}">
              <span class="name-dev-item-name">${n}</span>
              ${n === currentName ? '<span class="name-dev-check">✓</span>' : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };

    /* Backdrop / close button */
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#name-dev-close').addEventListener('click', close);

    /* Click on item */
    overlay.querySelectorAll('.name-dev-item').forEach(el => {
      el.addEventListener('click', () => {
        this._devNameOverride = el.dataset.name;
        localStorage.setItem('homepage_name', this._devNameOverride);
        this._render();
        close();
      });
    });

    /* Keyboard nav */
    const allItems = () => [...overlay.querySelectorAll('.name-dev-item')];

    const setFocus = (idx) => {
      focusIdx = ((idx % this._names.length) + this._names.length) % this._names.length;
      allItems().forEach((el, i) => el.classList.toggle('name-dev-item--focused', i === focusIdx));
      allItems()[focusIdx]?.scrollIntoView({ block: 'nearest' });
    };

    const onKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowDown')  { e.preventDefault(); setFocus(focusIdx + 1); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setFocus(focusIdx - 1); return; }
      if (e.key === 'Enter') {
        const name = this._names[focusIdx];
        if (name) {
          this._devNameOverride = name;
          localStorage.setItem('homepage_name', name);
          this._render();
          close();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('name-dev-popup--visible');
      setFocus(focusIdx);
    });
  }
}
