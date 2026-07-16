/**
 * QuickLinksManager
 * Renders a modern grid of glass buttons from preloaded quick links data.
 * Uses inline SVG injection for clean icon rendering without filter artifacts.
 *
 * Data is injected via constructor (preloaded by DataLoader) instead of
 * being fetched internally.
 *
 * In Chrome Extension mode, relative icon paths (e.g. 'assets/icons/foo.svg')
 * are resolved to absolute jsDelivr CDN URLs automatically so they load
 * correctly from the extension context.
 */
export class QuickLinksManager {
  /**
   * @param {HTMLElement} gridElement - the #quicklinks-grid element
   * @param {Array}       [links=[]]  - preloaded links array from DataLoader
   * @param {DataLoader}  [loader]    - DataLoader instance for icon URL resolution
   */
  constructor(gridElement, links = [], loader = null) {
    this._grid   = gridElement;
    this._links  = Array.isArray(links) ? links : [];
    this._loader = loader;
  }

  /**
   * Initialize: render links (data already loaded).
   */
  async init() {
    try {
      if (!this._links.length) {
        this._grid.style.display = 'none';
        return;
      }
      await this._render();
    } catch {
      /* Quick links unavailable — fail silently */
      this._grid.style.display = 'none';
    }
  }

  /**
   * Render all quick links into the grid using inline SVGs.
   */
  async _render() {
    this._grid.innerHTML = '';

    /* Fetch all SVGs in parallel */
    const svgTexts = await Promise.all(
      this._links.map(link =>
        fetch(this._resolveIconUrl(link.icon))
          .then(r => r.text())
          .catch(() => null)
      )
    );

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < this._links.length; i++) {
      const link = this._links[i];
      const a = document.createElement('a');
      a.className = 'quicklink-item';
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = link.title;

      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'quicklink-icon-wrapper';

      if (svgTexts[i]) {
        iconWrapper.innerHTML = svgTexts[i];
        const svg = iconWrapper.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', '24');
          svg.setAttribute('height', '24');
          svg.classList.add('quicklink-icon');
        }
      } else {
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

  /**
   * Resolve an icon path to a fetch-able URL.
   *
   * - If the path is already an absolute URL (http/https), use as-is.
   * - If running in extension mode, prefix the jsDelivr assets base URL.
   * - Otherwise, use the relative path as-is (works on website).
   *
   * @param {string} iconPath - path from quicklinks.json (e.g. 'assets/icons/foo.svg')
   * @returns {string}
   */
  _resolveIconUrl(iconPath) {
    /* Already absolute — use as-is */
    if (iconPath.startsWith('http://') || iconPath.startsWith('https://')) {
      return iconPath;
    }

    /* Extension mode — resolve to jsDelivr CDN */
    if (this._loader?.isExtension) {
      return `${this._loader.remoteBase}/${iconPath}`;
    }

    /* Website mode — relative path, served from same origin */
    return iconPath;
  }
}
