/**
 * QuickLinksManager
 * Loads quick links from JSON and renders a modern grid of glass buttons.
 * Uses inline SVG injection for clean icon rendering without filter artifacts.
 */
export class QuickLinksManager {
  /**
   * @param {HTMLElement} gridElement - the #quicklinks-grid element
   */
  constructor(gridElement) {
    this._grid = gridElement;
    this._links = [];
  }

  /**
   * Initialize: load links from JSON and render.
   */
  async init() {
    try {
      this._links = await this._loadLinks();
      await this._render();
    } catch {
      /* Quick links unavailable — fail silently */
      this._grid.style.display = 'none';
    }
  }

  /**
   * Load quick links from quicklinks.json.
   * @returns {Promise<Array>}
   */
  async _loadLinks() {
    const response = await fetch('data/quicklinks.json');
    if (!response.ok) throw new Error('Failed to load quicklinks.json');
    return response.json();
  }

  /**
   * Render all quick links into the grid using inline SVGs.
   */
  async _render() {
    this._grid.innerHTML = '';

    const fragment = document.createDocumentFragment();

    for (const link of this._links) {
      const a = document.createElement('a');
      a.className = 'quicklink-item';
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = link.title;

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'quicklink-icon-wrapper';

      /* Fetch SVG and inject inline so currentColor works */
      try {
        const res = await fetch(link.icon);
        const svgText = await res.text();
        iconWrapper.innerHTML = svgText;

        /* Ensure the inline SVG has proper sizing */
        const svg = iconWrapper.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', '24');
          svg.setAttribute('height', '24');
          svg.classList.add('quicklink-icon');
        }
      } catch {
        /* Fallback: show first letter */
        const fallback = document.createElement('span');
        fallback.className = 'quicklink-icon-fallback';
        fallback.textContent = link.title.charAt(0);
        iconWrapper.appendChild(fallback);
      }

      const label = document.createElement('span');
      label.className = 'quicklink-label';
      label.textContent = link.title;

      a.appendChild(iconWrapper);
      a.appendChild(label);
      fragment.appendChild(a);
    }

    this._grid.appendChild(fragment);
  }
}
