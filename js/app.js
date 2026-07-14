/**
 * App — Orchestrator
 * Loads config and initializes all managers in order.
 */
import { StorageManager } from './storage.js';
import { BackgroundManager } from './background.js';
import { GreetingManager } from './greeting.js';
import { ClockManager } from './clock.js';
import { SearchManager } from './search.js';
import { WeatherManager } from './weather.js';
import { QuickLinksManager } from './quicklinks.js';
import { BubbleManager } from './bubble.js';
import { MarketManager } from './market.js';
import { SidebarManager } from './sidebar.js';
import { ThemeManager } from './theme-manager.js';
import { HolidayManager } from './holidays.js';

class App {
  constructor() {
    this._config = null;
    this._managers = {};
  }

  /**
   * Bootstrap the application.
   */
  async init() {
    try {
      this._config = await this._loadConfig();
    } catch {
      /* Fallback config if file is unavailable */
      this._config = {
        name: 'User',
        theme: 'dark',
        searchEngine: 'google',
        adm4: '31.71.01.1001',
      };
    }

    this._applyTheme(this._config.theme);
    this._initManagers();
  }

  /**
   * Load configuration from config.json.
   * @returns {Promise<object>}
   */
  async _loadConfig() {
    const response = await fetch('data/config.json');
    if (!response.ok) throw new Error('Failed to load config.json');
    return response.json();
  }

  /**
   * Apply theme to the document.
   * @param {string} theme - 'dark' | 'light'
   */
  _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Initialize all managers.
   */
  async _initManagers() {
    const storage = new StorageManager('homepage');

    /* Background */
    const backgroundEl = document.getElementById('background');
    const background = new BackgroundManager(backgroundEl);
    background.init();

    /* Greeting — pass full config for devMode + names support */
    const greetingEl = document.getElementById('greeting-text');
    const greeting = new GreetingManager(greetingEl, this._config);
    await greeting.init();

    /* Theme Manager — pass devMode flag and greeting change callback */
    const theme = new ThemeManager(background, {
      devMode:          this._config.devMode?.theme ?? true,
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
    const clock = new ClockManager(clockTimeEl, clockDateEl);
    clock.init();

    /* Search */
    const search = new SearchManager({
      input: document.getElementById('search-input'),
      dropdown: document.getElementById('autocomplete-dropdown'),
      container: document.getElementById('search-container'),
      shortcut: document.getElementById('search-shortcut'),
    });
    search.init();

    /* Weather — callback notifies ThemeManager of the weather code */
    const weatherCard = document.getElementById('weather-card');
    const weather = new WeatherManager(
      weatherCard,
      this._config.adm4,
      (data) => theme.setWeatherCode(data.weatherCode),
    );
    weather.init();

    /* Quick Links */
    const quicklinksGrid = document.getElementById('quicklinks-grid');
    const quicklinks = new QuickLinksManager(quicklinksGrid);
    quicklinks.init();

    /* Market Prices */
    const marketCard = document.getElementById('market-card');
    const market = new MarketManager(marketCard);
    market.init();

    /* Letter Bubble (delayed for entrance effect) */
    const bubbleMessage = document.getElementById('bubble-message');
    const bubble = new BubbleManager(bubbleMessage, storage);
    setTimeout(() => bubble.init(), 2000);

    /* Holiday Widget */
    const holidayCard = document.getElementById('holiday-card');
    const holidays = new HolidayManager(holidayCard, this._config);
    holidays.init();

    /* Sidebar toggle */
    const sidebar = new SidebarManager(storage);
    sidebar.init();

    /* Store references */
    this._managers = {
      storage, background, greeting, clock,
      search, weather, quicklinks, market,
      bubble, sidebar, theme, holidays,
    };
  }
}

/* ---- Bootstrap ---- */
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
