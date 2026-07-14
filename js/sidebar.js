/**
 * SidebarManager
 * Handles hide/show toggle for the left sidebar.
 *
 * Entrance animation is applied once via `.sidebar-animating` class,
 * then removed after it finishes so the CSS `transition` can freely
 * control transform/opacity for hide/show without animation interference.
 *
 * State persists in localStorage across page reloads.
 */
export class SidebarManager {
  /** @param {StorageManager} storage */
  constructor(storage) {
    this._storage = storage;
    this._sidebar = document.getElementById('left-sidebar');
    this._toggle  = document.getElementById('sidebar-toggle');
    this._hidden  = false;
  }

  init() {
    if (!this._sidebar || !this._toggle) return;

    /* Restore persisted state instantly (no transition on first load) */
    this._hidden = this._storage.get('sidebar_hidden', false);
    this._applyInstant();

    /* Only play entrance animation if sidebar starts visible */
    if (!this._hidden) {
      this._playEntranceAnimation();
    }

    /* Click handler */
    this._toggle.addEventListener('click', () => this._toggleSidebar());

    /* Keyboard shortcut: Alt + S */
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this._toggleSidebar();
      }
    });
  }

  _toggleSidebar() {
    this._hidden = !this._hidden;
    this._storage.set('sidebar_hidden', this._hidden);

    /* Remove entrance animation class before toggling (safety) */
    this._sidebar.classList.remove('sidebar-animating');

    if (this._hidden) {
      this._sidebar.classList.add('sidebar-hidden');
      this._toggle.classList.add('sidebar-toggle--collapsed');
    } else {
      this._sidebar.classList.remove('sidebar-hidden');
      this._toggle.classList.remove('sidebar-toggle--collapsed');
    }
  }

  /**
   * Apply initial state immediately (no transition) by temporarily
   * disabling CSS transitions, applying classes, then re-enabling.
   */
  _applyInstant() {
    const { _sidebar: sidebar, _toggle: toggle } = this;

    sidebar.style.transition = 'none';
    toggle.style.transition  = 'none';
    void sidebar.offsetWidth; /* force reflow */

    if (this._hidden) {
      sidebar.classList.add('sidebar-hidden');
      toggle.classList.add('sidebar-toggle--collapsed');
    } else {
      sidebar.classList.remove('sidebar-hidden');
      toggle.classList.remove('sidebar-toggle--collapsed');
    }

    requestAnimationFrame(() => {
      sidebar.style.transition = '';
      toggle.style.transition  = '';
    });
  }

  /**
   * Add the entrance animation class once, then remove it after
   * the animation completes so it cannot interfere with transitions.
   */
  _playEntranceAnimation() {
    const sidebar = this._sidebar;
    sidebar.classList.add('sidebar-animating');

    /* Animation: 0.3s delay + 0.7s duration = 1000ms total */
    setTimeout(() => {
      sidebar.classList.remove('sidebar-animating');
    }, 1100);
  }
}
