/**
 * SearchManager
 * Handles the search box, Search Mode (Spotlight-like), and Google Autocomplete.
 */
export class SearchManager {
  /**
   * @param {object} elements - DOM elements
   * @param {HTMLInputElement} elements.input
   * @param {HTMLElement} elements.dropdown
   * @param {HTMLElement} elements.container
   * @param {HTMLElement} elements.shortcut
   */
  constructor(elements) {
    this._input = elements.input;
    this._dropdown = elements.dropdown;
    this._container = elements.container;
    this._shortcut = elements.shortcut;

    this._isSearchMode = false;
    this._suggestions = [];
    this._activeIndex = -1;
    this._debounceTimer = null;
    this._currentScript = null;
    this._currentCallback = null;
  }

  /**
   * Initialize event listeners.
   */
  init() {
    this._bindEvents();
    this._bindDropdownEvents();
  }

  /**
   * Bind all event listeners.
   */
  _bindEvents() {
    /* Focus / click on search box enters Search Mode */
    this._input.addEventListener('focus', () => this._enterSearchMode());

    /* Input changes trigger autocomplete */
    this._input.addEventListener('input', () => {
      this._debounce(() => this._fetchSuggestions(), 250);
    });

    /* Keyboard navigation */
    this._input.addEventListener('keydown', (e) => this._handleKeydown(e));

    /* Click outside exits Search Mode */
    document.addEventListener('click', (e) => {
      if (this._isSearchMode && !this._container.contains(e.target)) {
        this._exitSearchMode();
      }
    });

    /* Global Ctrl+K shortcut */
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this._input.focus();
        this._enterSearchMode();
      }
    });
  }

  /**
   * Enter Search Mode — fades other elements, expands search.
   */
  _enterSearchMode() {
    if (this._isSearchMode) return;
    this._isSearchMode = true;
    document.body.classList.add('search-mode');

    if (this._input.value.trim().length > 0) {
      this._fetchSuggestions();
    }
  }

  /**
   * Exit Search Mode — restores all elements.
   */
  _exitSearchMode() {
    if (!this._isSearchMode) return;
    this._isSearchMode = false;
    document.body.classList.remove('search-mode');
    this._hideSuggestions();
    this._input.blur();
  }

  /**
   * Handle keydown events on the search input.
   * @param {KeyboardEvent} e
   */
  _handleKeydown(e) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this._exitSearchMode();
        break;

      case 'ArrowDown':
        e.preventDefault();
        this._navigateSuggestions(1);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this._navigateSuggestions(-1);
        break;

      case 'Enter':
        e.preventDefault();
        if (this._activeIndex >= 0 && this._activeIndex < this._suggestions.length) {
          this._search(this._suggestions[this._activeIndex]);
        } else if (this._input.value.trim()) {
          this._search(this._input.value.trim());
        }
        break;

      default:
        break;
    }
  }

  /**
   * Navigate autocomplete suggestions with arrow keys.
   * @param {number} direction - 1 for down, -1 for up
   */
  _navigateSuggestions(direction) {
    if (this._suggestions.length === 0) return;

    this._activeIndex += direction;

    if (this._activeIndex < -1) {
      this._activeIndex = this._suggestions.length - 1;
    } else if (this._activeIndex >= this._suggestions.length) {
      this._activeIndex = -1;
    }

    this._updateActiveItem();

    /* Update input to show highlighted suggestion */
    if (this._activeIndex >= 0) {
      this._input.value = this._suggestions[this._activeIndex];
    }
  }

  /**
   * Perform a Google search.
   * @param {string} query
   */
  _search(query) {
    if (!query) return;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.location.href = url;
  }

  /**
   * Fetch autocomplete suggestions from Google using JSONP.
   */
  async _fetchSuggestions() {
    const query = this._input.value.trim();
    if (!query) {
      this._suggestions = [];
      this._hideSuggestions();
      return;
    }

    try {
      const results = await this._jsonpFetch(query);
      this._suggestions = results.slice(0, 6);
      this._activeIndex = -1;
      if (this._suggestions.length > 0 && this._isSearchMode) {
        this._renderSuggestions();
        this._showSuggestions();
      } else {
        this._hideSuggestions();
      }
    } catch {
      this._hideSuggestions();
    }
  }

  /**
   * JSONP fetch for Google Suggest API (bypasses CORS).
   * @param {string} query
   * @returns {Promise<string[]>}
   */
  _jsonpFetch(query) {
    return new Promise((resolve) => {
      /* Clean up previous JSONP call */
      this._cleanupJsonp();

      const callbackName = `_gac_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this._currentCallback = callbackName;

      const script = document.createElement('script');
      this._currentScript = script;

      const timeout = setTimeout(() => {
        resolve([]);
        this._cleanupJsonp();
      }, 3000);

      window[callbackName] = (data) => {
        clearTimeout(timeout);
        /* Google Suggest response: [query, [suggestions], ...] */
        resolve(Array.isArray(data[1]) ? data[1] : []);
        this._cleanupJsonp();
      };

      script.src = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}&callback=${callbackName}`;
      script.onerror = () => {
        clearTimeout(timeout);
        resolve([]);
        this._cleanupJsonp();
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Clean up JSONP script and callback.
   */
  _cleanupJsonp() {
    if (this._currentCallback && window[this._currentCallback]) {
      delete window[this._currentCallback];
    }
    if (this._currentScript && this._currentScript.parentNode) {
      this._currentScript.remove();
    }
    this._currentScript = null;
    this._currentCallback = null;
  }

  /**
   * Render autocomplete suggestions into the dropdown.
   * Uses event delegation — listeners are on the container, not individual items.
   */
  _renderSuggestions() {
    this._dropdown.innerHTML = this._suggestions
      .map((suggestion, index) => {
        const isActive = index === this._activeIndex;
        return `
          <div class="autocomplete-item${isActive ? ' active' : ''}"
               data-index="${index}">
            <svg class="autocomplete-item-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="8.5" cy="8.5" r="5.5"/>
              <line x1="12.5" y1="12.5" x2="17" y2="17" stroke-linecap="round"/>
            </svg>
            <span>${this._escapeHtml(suggestion)}</span>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Bind event delegation on the dropdown (called once during init).
   */
  _bindDropdownEvents() {
    /* Use mousedown instead of click — fires before blur/DOM changes */
    this._dropdown.addEventListener('mousedown', (e) => {
      e.preventDefault(); /* Prevent input from losing focus */
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      const index = parseInt(item.dataset.index, 10);
      this._search(this._suggestions[index]);
    });

    /* Hover: toggle active class without rebuilding DOM */
    this._dropdown.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      this._activeIndex = parseInt(item.dataset.index, 10);
      this._updateActiveItem();
    });
  }

  /**
   * Update the active class on autocomplete items without re-rendering.
   */
  _updateActiveItem() {
    const items = this._dropdown.querySelectorAll('.autocomplete-item');
    items.forEach((item, i) => {
      item.classList.toggle('active', i === this._activeIndex);
    });
  }

  /**
   * Show the autocomplete dropdown.
   */
  _showSuggestions() {
    this._dropdown.classList.add('visible');
  }

  /**
   * Hide the autocomplete dropdown.
   */
  _hideSuggestions() {
    this._dropdown.classList.remove('visible');
    this._suggestions = [];
    this._activeIndex = -1;
  }

  /**
   * Escape HTML to prevent XSS in suggestion rendering.
   * @param {string} str
   * @returns {string}
   */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Simple debounce utility.
   * @param {Function} fn
   * @param {number} delay
   */
  _debounce(fn, delay) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(fn, delay);
  }
}
