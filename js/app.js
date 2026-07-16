/**
 * App — Orchestrator
 * Initializes DataLoader first, preloads all JSON data in parallel,
 * then passes data directly to each manager. No manager fetches data
 * on its own — DataLoader is the single source of truth.
 */
import { DataLoader }        from './data-loader.js';
import { StorageManager }    from './storage.js';
import { BackgroundManager } from './background.js';
import { GreetingManager }   from './greeting.js';
import { ClockManager }      from './clock.js';
import { SearchManager }     from './search.js';
import { WeatherManager }    from './weather.js';
import { QuickLinksManager } from './quicklinks.js';
import { BubbleManager }     from './bubble.js';
import { MarketManager }     from './market.js';
import { SidebarManager }    from './sidebar.js';
import { ThemeManager }      from './theme-manager.js';
import { HolidayManager }    from './holidays.js';

class App {
  constructor() {
    this._data     = null;   // preloaded JSON map
    this._loader   = null;   // DataLoader instance (shared for icon URL resolution)
    this._managers = {};
  }

  /**
   * Bootstrap the application.
   */
  async init() {
    /* ── 1. Bootstrap DataLoader & StorageManager ── */
    const storage = new StorageManager('homepage');
    this._loader  = new DataLoader(storage);

    /* ── 2. Preload all JSON data in parallel (with fallback) ── */
    this._data = await this._loader.preloadAll();

    /* ── 3. Apply base theme immediately to avoid flash ── */
    this._applyTheme(this._data.config.theme ?? 'dark');

    /* ── 4. Initialize all managers ── */
    await this._initManagers(storage);

    /* ── 5. Reveal page (smooth fade from opacity:0) ── */
    document.body.classList.add('ready');
  }

  /**
   * Apply theme to the document.
   * @param {string} theme - 'dark' | 'light'
   */
  _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Initialize all managers, passing preloaded data via constructor args.
   * @param {StorageManager} storage
   */
  async _initManagers(storage) {
    const { config, greetings, letters, quicklinks, themes } = this._data;

    /* Background */
    const backgroundEl = document.getElementById('background');
    const background   = new BackgroundManager(backgroundEl);
    background.init();

    /* Greeting — receives config + preloaded greetings array */
    const greetingEl = document.getElementById('greeting-text');
    const greeting   = new GreetingManager(greetingEl, config, greetings);
    greeting.init(); // no longer async (data already loaded)

    /* Theme Manager — receives preloaded themes array */
    const theme = new ThemeManager(background, {
      themes:           themes.themes ?? [],
      devMode:          config.devMode?.theme ?? true,
      onGreetingChange: (text) => {
        if (text) greeting.setThemeGreeting(text);
        else      greeting.clearThemeGreeting();
      },
    });
    theme.init(); /* async — evaluates date themes immediately */

    /* Update background based on time period */
    const timePeriod = greeting.getTimePeriod();
    background.update(timePeriod, 'default');

    /* Clock */
    const clockTimeEl = document.getElementById('clock-time');
    const clockDateEl = document.getElementById('clock-date');
    const clock        = new ClockManager(clockTimeEl, clockDateEl);
    clock.init();

    /* Search */
    const search = new SearchManager({
      input:     document.getElementById('search-input'),
      dropdown:  document.getElementById('autocomplete-dropdown'),
      container: document.getElementById('search-container'),
      shortcut:  document.getElementById('search-shortcut'),
    });
    search.init();

    /* Weather — callback notifies ThemeManager of the weather code */
    const weatherCard = document.getElementById('weather-card');
    const weather     = new WeatherManager(
      weatherCard,
      config.adm4,
      (data) => theme.setWeatherCode(data.weatherCode),
    );
    weather.init();

    /* Quick Links — await so icons are ready before body reveals */
    const quicklinksGrid = document.getElementById('quicklinks-grid');
    const ql             = new QuickLinksManager(quicklinksGrid, quicklinks, this._loader);
    await ql.init();

    /* Market Prices — unchanged; fetches from external APIs */
    const marketCard = document.getElementById('market-card');
    const market     = new MarketManager(marketCard);
    market.init();

    /* Letter Bubble — receives preloaded letters (delayed for entrance effect) */
    const bubbleMessage = document.getElementById('bubble-message');
    const bubble        = new BubbleManager(bubbleMessage, storage, letters);
    setTimeout(() => bubble.init(), 2000);

    /* Holiday Widget — unchanged; fetches national holidays from nager.at */
    const holidayCard = document.getElementById('holiday-card');
    const holidays    = new HolidayManager(holidayCard, config);
    holidays.init();

    /* Sidebar toggle */
    const sidebar = new SidebarManager(storage);
    sidebar.init();

    /* Store references */
    this._managers = {
      storage, background, greeting, clock,
      search, weather, ql, market,
      bubble, sidebar, theme, holidays,
    };
  }
}

/* ---- Bootstrap ---- */
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
