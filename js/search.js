/**
 * SearchManager
 * Handles the search box, Search Mode (Spotlight-like), and Google Autocomplete.
 *
 * Improvements:
 *  - Recent searches shown on empty focus (with timestamps for smart sorting)
 *  - Per-item delete (×) button on recent searches
 *  - "Clear all" button in the recent searches header
 *  - Matched query substring highlighted in suggestion text
 *  - Tab key completes the top suggestion
 *  - Stagger entrance animation on dropdown items
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
    this._input      = elements.input;
    this._dropdown   = elements.dropdown;
    this._container  = elements.container;
    this._shortcut   = elements.shortcut;

    this._isSearchMode   = false;
    this._suggestions    = [];   // { text, isRecent, ts? }
    this._activeIndex    = -1;
    this._debounceTimer  = null;
    this._originalValue  = '';   // tracks value before arrow-key navigation

    /** @type {{ text: string, ts: number }[]} */
    this._recentSearches = this._loadRecentSearches();
  }

  /* ─────────────────────────────────────────
     PUBLIC
  ───────────────────────────────────────── */

  init() {
    this._bindEvents();
    this._bindDropdownEvents();
  }

  /* ─────────────────────────────────────────
     EVENT BINDING
  ───────────────────────────────────────── */

  _bindEvents() {
    /* Focus → enter Search Mode + show recents if empty */
    this._input.addEventListener('focus', () => {
      this._enterSearchMode();
      if (!this._input.value.trim()) {
        this._showRecentSearches();
      }
    });

    /* Input changes → debounced autocomplete */
    this._input.addEventListener('input', () => {
      this._originalValue = this._input.value;
      this._debounce(() => this._fetchSuggestions(), 220);
    });

    /* Keyboard navigation */
    this._input.addEventListener('keydown', (e) => this._handleKeydown(e));

    /* Click outside → exit Search Mode */
    document.addEventListener('click', (e) => {
      if (this._isSearchMode && !this._container.contains(e.target)) {
        this._exitSearchMode();
      }
    });

    /* Global shortcuts & type-to-search */
    document.addEventListener('keydown', (e) => {
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable
      ) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this._input.focus();
        this._enterSearchMode();
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key.length === 1) {
        this._input.focus();
        // character naturally goes into the focused input
      }
    });
  }

  /* ─────────────────────────────────────────
     SEARCH MODE
  ───────────────────────────────────────── */

  _enterSearchMode() {
    if (this._isSearchMode) return;
    this._isSearchMode = true;
    document.body.classList.add('search-mode');

    if (this._input.value.trim().length > 0) {
      this._fetchSuggestions();
    }
  }

  _exitSearchMode() {
    if (!this._isSearchMode) return;
    this._isSearchMode = false;
    document.body.classList.remove('search-mode');
    this._hideSuggestions();
    this._input.blur();
  }

  /* ─────────────────────────────────────────
     KEYBOARD HANDLING
  ───────────────────────────────────────── */

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

      case 'Tab':
        if (this._suggestions.length > 0) {
          e.preventDefault();
          this._navigateSuggestions(e.shiftKey ? -1 : 1);
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (this._activeIndex >= 0 && this._activeIndex < this._suggestions.length) {
          this._search(this._suggestions[this._activeIndex].text);
        } else if (this._input.value.trim()) {
          this._search(this._input.value.trim());
        }
        break;

      default:
        break;
    }
  }

  /* ─────────────────────────────────────────
     NAVIGATION
  ───────────────────────────────────────── */

  _navigateSuggestions(direction) {
    if (this._suggestions.length === 0) return;

    this._activeIndex += direction;

    if (this._activeIndex < -1) {
      this._activeIndex = this._suggestions.length - 1;
    } else if (this._activeIndex >= this._suggestions.length) {
      this._activeIndex = -1;
    }

    this._updateActiveItem();

    /* Reflect highlighted suggestion in input, restore original on -1 */
    if (this._activeIndex >= 0) {
      this._input.value = this._suggestions[this._activeIndex].text;
    } else {
      this._input.value = this._originalValue;
    }
  }

  /* ─────────────────────────────────────────
     RECENT SEARCHES — STORAGE
  ───────────────────────────────────────── */

  /** @returns {{ text: string, ts: number }[]} */
  _loadRecentSearches() {
    try {
      const saved = localStorage.getItem('recent_searches_v2');
      if (saved) return JSON.parse(saved);

      /* Migrate legacy flat-string format */
      const legacy = localStorage.getItem('recent_searches');
      if (legacy) {
        const arr = JSON.parse(legacy);
        return arr.map((text, i) => ({ text, ts: Date.now() - i * 1000 }));
      }
      return [];
    } catch {
      return [];
    }
  }

  _persistRecentSearches() {
    try {
      localStorage.setItem('recent_searches_v2', JSON.stringify(this._recentSearches));
    } catch (e) {
      console.error('Failed to save recent searches', e);
    }
  }

  /**
   * Add a query to recent searches (deduped, most-recent first).
   * @param {string} query
   */
  _saveRecentSearch(query) {
    const trimmed = query.trim();
    if (!trimmed) return;

    this._recentSearches = this._recentSearches.filter(
      s => s.text.toLowerCase() !== trimmed.toLowerCase()
    );
    this._recentSearches.unshift({ text: trimmed, ts: Date.now() });

    if (this._recentSearches.length > 50) this._recentSearches.pop();
    this._persistRecentSearches();
  }

  /**
   * Remove a single recent search by text.
   * @param {string} text
   */
  _deleteRecentSearch(text) {
    this._recentSearches = this._recentSearches.filter(
      s => s.text.toLowerCase() !== text.toLowerCase()
    );
    this._persistRecentSearches();
  }

  /** Clear all recent searches. */
  _clearAllRecentSearches() {
    this._recentSearches = [];
    this._persistRecentSearches();
  }

  /* ─────────────────────────────────────────
     SEARCH
  ───────────────────────────────────────── */

  _search(query) {
    if (!query) return;
    this._saveRecentSearch(query);
    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  /* ─────────────────────────────────────────
     SUGGESTIONS — FETCH
  ───────────────────────────────────────── */

  /**
   * Show recent searches when the input is empty (on focus).
   */
  _showRecentSearches() {
    if (this._recentSearches.length === 0) return;

    /* Sort by recency (ts desc) — already stored that way, but be safe */
    const sorted = [...this._recentSearches]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 6);

    this._suggestions = sorted.map(s => ({ text: s.text, isRecent: true }));
    this._activeIndex = -1;

    if (this._isSearchMode) {
      this._renderSuggestions('', true);
      this._showSuggestions();
    }
  }

  /**
   * Fetch autocomplete suggestions (local recents + Google).
   */
  async _fetchSuggestions() {
    const query = this._input.value.trim();

    if (!query) {
      this._showRecentSearches();
      return;
    }

    const lowerQuery = query.toLowerCase();

    /* 1. Matching recent searches */
    const matchedRecents = this._recentSearches
      .filter(s => s.text.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 3)
      .map(s => ({ text: s.text, isRecent: true }));

    /* 2. Google suggestions */
    let googleSuggestions = [];
    try {
      const response = await fetch(
        `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && Array.isArray(data[1])) {
          googleSuggestions = data[1]
            .filter(s => !matchedRecents.some(r => r.text.toLowerCase() === s.toLowerCase()))
            .slice(0, 6 - matchedRecents.length)
            .map(s => ({ text: s, isRecent: false }));
        }
      }
    } catch (e) {
      console.warn('Failed to fetch Google suggestions:', e);
    }

    /* 3. Combine */
    this._suggestions = [...matchedRecents, ...googleSuggestions];
    this._activeIndex = -1;

    if (this._suggestions.length > 0 && this._isSearchMode) {
      this._renderSuggestions(query, false);
      this._showSuggestions();
    } else {
      this._hideSuggestions();
    }
  }

  /* ─────────────────────────────────────────
     SUGGESTIONS — RENDER
  ───────────────────────────────────────── */

  /**
   * Render suggestions into the dropdown.
   * @param {string} query   - current input value (used for highlight)
   * @param {boolean} isEmptyState - true when showing recents on empty input
   */
  _renderSuggestions(query, isEmptyState) {
    const hasRecents = this._suggestions.some(s => s.isRecent);

    /* ── Header (only when showing recents) ── */
    let headerHtml = '';
    if (isEmptyState && hasRecents) {
      headerHtml = `
        <div class="autocomplete-header">
          <span class="autocomplete-header-label">Recent</span>
          <button class="autocomplete-clear-all" data-action="clear-all" title="Clear all recent searches">
            Clear all
          </button>
        </div>`;
    }

    /* ── Items ── */
    const itemsHtml = this._suggestions
      .map((suggestion, index) => {
        const isActive = index === this._activeIndex;

        const iconSvg = suggestion.isRecent
          ? `<svg class="autocomplete-item-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
               <circle cx="10" cy="10" r="7"/>
               <path d="M10 6V10L13 13" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>`
          : `<svg class="autocomplete-item-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
               <circle cx="8.5" cy="8.5" r="5.5"/>
               <line x1="12.5" y1="12.5" x2="17" y2="17" stroke-linecap="round"/>
             </svg>`;

        const labelHtml = query
          ? this._highlightMatch(suggestion.text, query)
          : this._escapeHtml(suggestion.text);

        const deleteBtn = suggestion.isRecent
          ? `<button class="autocomplete-item-delete" data-action="delete" data-text="${this._escapeAttr(suggestion.text)}" title="Remove">
               <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                 <line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/>
               </svg>
             </button>`
          : '';

        return `
          <div class="autocomplete-item${isActive ? ' active' : ''}"
               data-index="${index}"
               style="--item-index: ${index}">
            ${iconSvg}
            <span class="autocomplete-item-text">${labelHtml}</span>
            ${deleteBtn}
          </div>`;
      })
      .join('');

    /* ── Footer hint (Tab to complete) ── */
    const footerHtml = this._suggestions.length > 0
      ? `<div class="autocomplete-footer">
           <span class="autocomplete-footer-hint">
             <kbd>↑↓</kbd> navigate &nbsp;·&nbsp; <kbd>Tab</kbd> complete &nbsp;·&nbsp; <kbd>↵</kbd> search
           </span>
         </div>`
      : '';

    this._dropdown.innerHTML = headerHtml + itemsHtml + footerHtml;
  }

  /* ─────────────────────────────────────────
     DROPDOWN EVENTS (delegation)
  ───────────────────────────────────────── */

  _bindDropdownEvents() {
    /* mousedown fires before blur — prevents input losing focus */
    this._dropdown.addEventListener('mousedown', (e) => {
      e.preventDefault();

      /* Delete button */
      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        const text = deleteBtn.dataset.text;
        this._deleteRecentSearch(text);
        this._suggestions = this._suggestions.filter(
          s => s.text.toLowerCase() !== text.toLowerCase()
        );
        if (this._suggestions.length === 0) {
          this._hideSuggestions();
        } else {
          const query = this._input.value.trim();
          this._renderSuggestions(query, !query);
        }
        return;
      }

      /* Clear all button */
      const clearAll = e.target.closest('[data-action="clear-all"]');
      if (clearAll) {
        this._clearAllRecentSearches();
        this._hideSuggestions();
        return;
      }

      /* Regular item click */
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      const index = parseInt(item.dataset.index, 10);
      this._search(this._suggestions[index].text);
    });

    /* Hover: update active without re-render */
    this._dropdown.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (!item) return;
      this._activeIndex = parseInt(item.dataset.index, 10);
      this._updateActiveItem();
    });

    /* Mouse leaves dropdown → reset active to -1 */
    this._dropdown.addEventListener('mouseleave', () => {
      this._activeIndex = -1;
      this._updateActiveItem();
    });
  }

  /* ─────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────── */

  _updateActiveItem() {
    const items = this._dropdown.querySelectorAll('.autocomplete-item');
    items.forEach((item, i) => {
      item.classList.toggle('active', i === this._activeIndex);
    });
  }

  _showSuggestions() {
    this._dropdown.classList.add('visible');
  }

  _hideSuggestions() {
    this._dropdown.classList.remove('visible');
    this._suggestions = [];
    this._activeIndex = -1;
  }

  /**
   * Wrap matched substring in a <mark> for highlighting.
   * @param {string} text
   * @param {string} query
   * @returns {string} safe HTML
   */
  _highlightMatch(text, query) {
    const escaped = this._escapeHtml(text);
    const escapedQuery = this._escapeHtml(query);
    const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark class="autocomplete-highlight">$1</mark>');
  }

  /** Escape HTML to prevent XSS. */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** Escape for use in HTML attribute values. */
  _escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Simple debounce. */
  _debounce(fn, delay) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(fn, delay);
  }
}
