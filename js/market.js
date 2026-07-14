/**
 * MarketManager
 * Fetches and displays live market prices:
 *  - Emas Pegadaian (harga jual & beli per gram)
 *  - IHSG (IDX Composite index)
 *
 * Data sources:
 *  - Pegadaian: logam-mulia-api.iamutaki.workers.dev (CORS-enabled, free)
 *  - IHSG: Yahoo Finance via CORS proxy, with graceful fallback
 *
 * Refreshes every 30 minutes. Caches per session via sessionStorage.
 */
export class MarketManager {
  /** @type {HTMLElement} */
  _card;

  /** @type {number|null} */
  _refreshTimer = null;

  /** Cache TTL in milliseconds (30 minutes) */
  static CACHE_TTL = 30 * 60 * 1000;

  /** Pegadaian API endpoint */
  static GOLD_URL = 'https://logam-mulia-api.iamutaki.workers.dev/api/prices/pegadaian';

  /** IHSG data via Yahoo Finance */
  static IHSG_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?interval=1d&range=1d';

  /** CORS proxy fallback */
  static CORS_PROXY = 'https://corsproxy.io/?';

  /**
   * @param {HTMLElement} cardElement - the #market-card element
   */
  constructor(cardElement) {
    this._card = cardElement;
  }

  /**
   * Initialize: fetch data and start auto-refresh.
   */
  async init() {
    await this._refresh();

    /* Auto-refresh every 30 minutes */
    this._refreshTimer = setInterval(() => this._refresh(), MarketManager.CACHE_TTL);
  }

  /**
   * Fetch all market data and re-render.
   */
  async _refresh() {
    const [gold, ihsg] = await Promise.allSettled([
      this._fetchGold(),
      this._fetchIHSG(),
    ]);

    this._render(
      gold.status === 'fulfilled' ? gold.value : null,
      ihsg.status === 'fulfilled' ? ihsg.value : null,
    );
  }

  /* ------------------------------------------------------------------ */
  /* Gold (Pegadaian)                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Fetch Pegadaian gold prices.
   * Uses sessionStorage cache (TTL = 30 min).
   * @returns {Promise<{ jual: number, beli: number, date: string }|null>}
   */
  async _fetchGold() {
    const cached = this._getCache('market_gold');
    if (cached) return cached;

    /* 1. Try Vercel proxy first (works in production without CORS issues) */
    try {
      return await this._fetchGoldLive('/api/gold');
    } catch {
      /* 2. Try direct live API (might work locally) */
      try {
        return await this._fetchGoldLive(MarketManager.GOLD_URL);
      } catch {
        /* Both failed, throw error to handle gracefully */
        throw new Error('All gold fetches failed');
      }
    }
  }

  /**
   * Fetch and parse gold data from a specific URL.
   * @param {string} url
   * @returns {Promise<{ jual: number, beli: number, date: string }>}
   */
  async _fetchGoldLive(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Gold API failed: ' + response.status);

    const json = await response.json();
    if (!json.success) throw new Error('Gold API returned error');

    const item = json.data?.[0];
    if (!item) throw new Error('No gold data in response');

    /* API returns price per 0.01 gram — convert to per gram */
    const weightGram = item.weight ?? 0.01;
    const factor = 1 / weightGram;

    const data = {
      jual: Math.round(item.sellPrice * factor),
      beli: Math.round(item.buybackPrice * factor),
      date: item.recordedDate ?? '',
    };

    this._setCache('market_gold', data);
    return data;
  }


  /* IHSG                                                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Fetch IHSG from Yahoo Finance.
   * Tries direct fetch first; falls back to CORS proxy; fails gracefully.
   * @returns {Promise<{ value: number, change: number, changePct: number }|null>}
   */
  async _fetchIHSG() {
    const cached = this._getCache('market_ihsg');
    if (cached) return cached;

    const json = await this._fetchIHSGWithFallback();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) throw new Error('No IHSG data in response');

    const value = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    const change = value - prevClose;
    const changePct = (change / prevClose) * 100;

    const data = {
      value: Math.round(value * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
    };

    this._setCache('market_ihsg', data);
    return data;
  }

  /**
   * Attempt IHSG fetch: direct → CORS proxy → throw.
   * @returns {Promise<object>}
   */
  async _fetchIHSGWithFallback() {
    /* 1. Try Vercel proxy first */
    try {
      const res = await fetch('/api/ihsg');
      if (res.ok) return res.json();
    } catch {
      /* Vercel proxy failed */
    }

    /* 2. Try direct (works on some browsers / environments) */
    try {
      const res = await fetch(MarketManager.IHSG_URL, { mode: 'cors' });
      if (res.ok) return res.json();
    } catch {
      /* CORS blocked — throw */
    }

    throw new Error('IHSG proxy failed');
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Render market data into the card.
   * Uses document.getElementById for reliable element lookup.
   * @param {{ jual: number, beli: number, date: string }|null} gold
   * @param {{ value: number, change: number, changePct: number }|null} ihsg
   */
  _render(gold, ihsg) {
    /* Use document.getElementById — more reliable than element.querySelector('#id') */
    const goldEl = document.getElementById('market-gold');
    const ihsgEl = document.getElementById('market-ihsg');
    const dividerEl = this._card ? this._card.querySelector('.market-divider') : null;

    /* ---- Gold ---- */
    if (gold && goldEl) {
      const jualEl = goldEl.querySelector('.market-gold-jual');
      const beliEl = goldEl.querySelector('.market-gold-beli');
      const dateEl = goldEl.querySelector('.market-gold-date');

      if (jualEl) jualEl.textContent = this._formatRupiah(gold.jual);
      if (beliEl) beliEl.textContent = this._formatRupiah(gold.beli);
      if (dateEl) dateEl.textContent = gold.date
        ? `per ${this._formatDate(gold.date)}`
        : '';

      goldEl.classList.remove('unavailable');
      goldEl.classList.add('loaded');
    } else if (goldEl) {
      goldEl.classList.add('unavailable');
    }

    /* ---- IHSG ---- */
    if (ihsg && ihsgEl) {
      const valueEl = ihsgEl.querySelector('.market-ihsg-value');
      const changeEl = ihsgEl.querySelector('.market-ihsg-change');

      if (valueEl) valueEl.textContent = ihsg.value.toLocaleString('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      if (changeEl) {
        const sign = ihsg.changePct >= 0 ? '+' : '';
        changeEl.textContent = `${sign}${ihsg.changePct.toFixed(2)}%`;
        changeEl.dataset.trend = ihsg.changePct >= 0 ? 'up' : 'down';
      }

      ihsgEl.classList.remove('unavailable');
      ihsgEl.classList.add('loaded');
    } else if (ihsgEl) {
      /* Hide IHSG section gracefully if data unavailable */
      ihsgEl.classList.add('unavailable');
    }

    /* ---- Divider ---- */
    if (dividerEl) {
      if (gold && ihsg) {
        dividerEl.style.display = '';
      } else {
        dividerEl.style.display = 'none';
      }
    }

    /* ---- Entire Card Visibility ---- */
    if (!gold && !ihsg && this._card) {
      this._card.style.display = 'none';
    } else if (this._card) {
      this._card.style.display = '';
      this._card.classList.add('loaded');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Format a number as Rupiah string.
   * @param {number} value
   * @returns {string} e.g. "Rp 2.531.000"
   */
  _formatRupiah(value) {
    return 'Rp\u00A0' + value.toLocaleString('id-ID');
  }

  /**
   * Format "YYYY-MM-DD" as "DD MMM YYYY".
   * @param {string} dateStr
   * @returns {string}
   */
  _formatDate(dateStr) {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  /**
   * Read from sessionStorage cache.
   * @param {string} key
   * @returns {any|null}
   */
  _getCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { data, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp > MarketManager.CACHE_TTL) return null;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Write to sessionStorage cache.
   * @param {string} key
   * @param {any} data
   */
  _setCache(key, data) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
      /* sessionStorage unavailable — ignore */
    }
  }
}
