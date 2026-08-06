/**
 * NotesManager
 * Sticky notes — modal input + right sidebar display.
 *
 * Architecture:
 *  - Left sidebar button  → opens centered modal for adding a note
 *  - Right sidebar        → displays note cards (like left sidebar, hideable)
 *  - Right sidebar toggle → fixed button on left edge of right sidebar
 *  - Keyboard: Alt+N = open add modal, Escape = close modal, Alt+M = toggle right sidebar
 *  - Reminders: every 30s, fires browser Notification + in-page toast
 *                when a note's datetime is within the next 15 minutes
 */
export class NotesManager {
  /** @param {StorageManager} storage */
  constructor(storage) {
    this._storage        = storage;
    this._notes          = [];
    this._sidebarHidden  = false;
    this._modalOpen      = false;
    this._editingId      = null;   // null = add mode, string = edit mode
    this._reminderTimer  = null;
    this._notifiedIds    = new Set();
  }

  /* ── Public ── */

  init() {
    this._notes          = this._storage.get('notes', []);
    this._sidebarHidden  = this._storage.get('notes_sidebar_hidden', false);
    this._notifiedIds    = new Set(this._storage.get('notes_notified', []));

    this._buildDOM();
    this._bindEvents();
    this._applyInstant();
    this._render();
    this._startReminderLoop();
    this._requestNotificationPermission();
  }

  /* ── DOM Construction ── */

  _buildDOM() {
    /* ── Right Sidebar ── */
    this._rightSidebar = document.createElement('aside');
    this._rightSidebar.id = 'notes-right-sidebar';
    this._rightSidebar.innerHTML = `
      <div class="notes-rs__header">
        <div class="notes-rs__title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h12v10l-3.5 3.5H4V4z"/>
            <line x1="7" y1="8" x2="13" y2="8"/>
            <line x1="7" y1="11" x2="11" y2="11"/>
          </svg>
          <span>Notes</span>
        </div>
        <button id="notes-rs-add-btn" class="notes-rs__add-btn" aria-label="Add note (Alt+N)"
          title="Add note (Alt+N)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round">
            <line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/>
          </svg>
        </button>
      </div>
      <div id="notes-rs-list" class="notes-rs__list"></div>
    `;
    document.body.appendChild(this._rightSidebar);

    /* ── Right Sidebar Toggle Button ── */
    this._rsToggle = document.createElement('button');
    this._rsToggle.id = 'notes-rs-toggle';
    this._rsToggle.setAttribute('aria-label', 'Toggle notes sidebar (Alt+M)');
    this._rsToggle.setAttribute('title', 'Toggle notes sidebar (Alt+M)');
    this._rsToggle.innerHTML = `
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2"
        stroke-linecap="round" stroke-linejoin="round">
        <polyline points="7 5 13 10 7 15"/>
      </svg>
    `;
    document.body.appendChild(this._rsToggle);

    /* ── Toast Container ── */
    this._toastContainer = document.createElement('div');
    this._toastContainer.id = 'notes-toast-container';
    document.body.appendChild(this._toastContainer);

    /* ── Modal Backdrop ── */
    this._modalBackdrop = document.createElement('div');
    this._modalBackdrop.id = 'note-modal-backdrop';
    document.body.appendChild(this._modalBackdrop);

    /* ── Add Note Modal ── */
    this._modal = document.createElement('div');
    this._modal.id = 'note-modal';
    this._modal.setAttribute('role', 'dialog');
    this._modal.setAttribute('aria-modal', 'true');
    this._modal.setAttribute('aria-label', 'Add note');
    this._modal.innerHTML = `
      <div class="note-modal__header">
        <h2 class="note-modal__title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h12v10l-3.5 3.5H4V4z"/>
            <line x1="7" y1="8" x2="13" y2="8"/>
            <line x1="7" y1="11" x2="11" y2="11"/>
          </svg>
          Add Note
        </h2>
        <button id="note-modal-close" class="note-modal__close" aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round">
            <line x1="4" y1="4" x2="12" y2="12"/>
            <line x1="12" y1="4" x2="4" y2="12"/>
          </svg>
        </button>
      </div>

      <form id="note-modal-form" class="note-modal__form" novalidate>
        <div class="note-modal__group">
          <label for="nm-title" class="note-modal__label">
            Title <span class="note-modal__required">*</span>
          </label>
          <input id="nm-title" type="text" class="note-modal__input"
            placeholder="What's on your mind?" maxlength="80" required autocomplete="off" />
        </div>

        <div class="note-modal__group">
          <label for="nm-desc" class="note-modal__label">Description</label>
          <textarea id="nm-desc" class="note-modal__textarea"
            placeholder="Add some details..." rows="3" maxlength="400"></textarea>
        </div>

        <div class="note-modal__row">
          <div class="note-modal__group">
            <label for="nm-datetime" class="note-modal__label">
              Remind at
              <span class="note-modal__hint">— optional</span>
            </label>
            <input id="nm-datetime" type="datetime-local" class="note-modal__input note-modal__input--date" />
          </div>

          <div class="note-modal__group">
            <label for="nm-link" class="note-modal__label">
              Link
              <span class="note-modal__hint">— optional</span>
            </label>
            <input id="nm-link" type="url" class="note-modal__input"
              placeholder="https://..." autocomplete="off" />
          </div>
        </div>

        <div class="note-modal__actions">
          <button type="button" id="note-modal-cancel" class="note-modal__btn note-modal__btn--cancel">
            Cancel
          </button>
          <button type="submit" class="note-modal__btn note-modal__btn--submit">
            Add Note
          </button>
        </div>
      </form>
    `;
    document.body.appendChild(this._modal);

    /* Cache list ref */
    this._listEl = this._rightSidebar.querySelector('#notes-rs-list');
  }

  /* ── Events ── */

  _bindEvents() {
    /* Right sidebar "+" btn → open add modal */
    this._rightSidebar.querySelector('#notes-rs-add-btn')
      .addEventListener('click', () => this._openModal());

    /* Right sidebar toggle */
    this._rsToggle.addEventListener('click', () => this._toggleSidebar());

    /* Modal close btn */
    this._modal.querySelector('#note-modal-close')
      .addEventListener('click', () => this._closeModal());

    /* Modal cancel btn */
    this._modal.querySelector('#note-modal-cancel')
      .addEventListener('click', () => this._closeModal());

    /* Backdrop click */
    this._modalBackdrop.addEventListener('click', () => this._closeModal());

    /* Form submit */
    this._modal.querySelector('#note-modal-form')
      .addEventListener('submit', (e) => { e.preventDefault(); this._submitNote(); });

    /* Keyboard shortcuts */
    document.addEventListener('keydown', (e) => {
      /* Alt+N → open add modal */
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this._openModal();
      }
      /* Alt+M → toggle right sidebar */
      if (e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        this._toggleSidebar();
      }
      /* Escape → close modal */
      if (e.key === 'Escape' && this._modalOpen) {
        this._closeModal();
      }
    });
  }

  /* ── Right Sidebar Toggle ── */

  _toggleSidebar() {
    this._sidebarHidden = !this._sidebarHidden;
    this._storage.set('notes_sidebar_hidden', this._sidebarHidden);
    this._applyToggle();
  }

  _applyInstant() {
    const { _rightSidebar: rs, _rsToggle: btn } = this;
    rs.style.transition  = 'none';
    btn.style.transition = 'none';
    void rs.offsetWidth;
    this._applyClasses();
    requestAnimationFrame(() => {
      rs.style.transition  = '';
      btn.style.transition = '';
    });
  }

  _applyToggle() {
    this._rightSidebar.classList.remove('notes-rs--animating');
    this._applyClasses();
  }

  _applyClasses() {
    if (this._sidebarHidden) {
      this._rightSidebar.classList.add('notes-rs--hidden');
      this._rsToggle.classList.add('notes-rs-toggle--collapsed');
    } else {
      this._rightSidebar.classList.remove('notes-rs--hidden');
      this._rsToggle.classList.remove('notes-rs-toggle--collapsed');
    }
  }

  /* ── Modal ── */

  _openModal(noteId = null) {
    this._editingId = noteId;
    this._modalOpen = true;

    /* Update modal title + submit label */
    const titleEl  = this._modal.querySelector('.note-modal__title span') ||
                     this._modal.querySelector('.note-modal__title');
    const submitBtn = this._modal.querySelector('.note-modal__btn--submit');

    if (noteId) {
      const note = this._notes.find(n => n.id === noteId);
      if (!note) return;
      /* Prefill form */
      this._modal.querySelector('#nm-title').value    = note.title ?? '';
      this._modal.querySelector('#nm-desc').value     = note.desc ?? '';
      this._modal.querySelector('#nm-datetime').value = note.datetime ?? '';
      this._modal.querySelector('#nm-link').value     = note.link ?? '';
      if (submitBtn) submitBtn.textContent = 'Save';
    } else {
      this._modal.querySelector('#note-modal-form').reset();
      if (submitBtn) submitBtn.textContent = 'Add Note';
    }

    this._modal.classList.add('note-modal--open');
    this._modalBackdrop.classList.add('note-modal-backdrop--visible');
    document.body.classList.add('note-modal-body-lock');

    requestAnimationFrame(() => {
      this._modal.querySelector('#nm-title').focus();
    });
  }

  _closeModal() {
    this._editingId = null;
    this._modalOpen = false;
    this._modal.classList.remove('note-modal--open');
    this._modalBackdrop.classList.remove('note-modal-backdrop--visible');
    document.body.classList.remove('note-modal-body-lock');
    this._modal.querySelector('#note-modal-form').reset();
  }

  /* ── CRUD ── */

  _submitNote() {
    const title    = this._modal.querySelector('#nm-title').value.trim();
    const desc     = this._modal.querySelector('#nm-desc').value.trim();
    const datetime = this._modal.querySelector('#nm-datetime').value || null;
    const link     = this._modal.querySelector('#nm-link').value.trim() || null;

    if (!title) {
      this._modal.querySelector('#nm-title').focus();
      return;
    }

    if (this._editingId) {
      /* ── Edit existing note ── */
      const idx = this._notes.findIndex(n => n.id === this._editingId);
      if (idx !== -1) {
        this._notes[idx] = {
          ...this._notes[idx],
          title,
          desc:     desc || null,
          datetime,
          link,
          updatedAt: Date.now(),
        };
        /* Reset reminder if datetime changed */
        if (datetime !== this._notes[idx]?.datetime) {
          this._notifiedIds.delete(this._editingId);
        }
      }
    } else {
      /* ── Add new note ── */
      const note = {
        id:        `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title,
        desc:      desc || null,
        datetime,
        link,
        createdAt: Date.now(),
      };
      this._notes.unshift(note);

      /* Auto-show right sidebar if hidden */
      if (this._sidebarHidden) {
        this._sidebarHidden = false;
        this._storage.set('notes_sidebar_hidden', false);
        this._applyToggle();
      }
    }

    this._save();
    this._render();
    this._closeModal();
  }

  _deleteNote(id) {
    this._notes = this._notes.filter(n => n.id !== id);
    this._notifiedIds.delete(id);
    this._save();
    this._render();
  }

  _save() {
    this._storage.set('notes', this._notes);
    this._storage.set('notes_notified', [...this._notifiedIds]);
  }

  /* ── Render ── */

  _render() {
    if (!this._listEl) return;

    if (this._notes.length === 0) {
      this._listEl.innerHTML = `
        <div class="notes-rs__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p>No notes yet</p>
        </div>
      `;
      return;
    }

    this._listEl.innerHTML = this._notes.map(n => this._noteCard(n)).join('');

    this._listEl.querySelectorAll('.note-card-rs__delete').forEach(btn => {
      btn.addEventListener('click', () => this._deleteNote(btn.dataset.id));
    });

    this._listEl.querySelectorAll('.note-card-rs__edit').forEach(btn => {
      btn.addEventListener('click', () => this._openModal(btn.dataset.id));
    });
  }

  _noteCard(note) {
    const now      = Date.now();
    const hasTime  = !!note.datetime;
    const target   = hasTime ? new Date(note.datetime).getTime() : null;
    const diffMs   = target ? target - now : null;
    const diffMin  = diffMs !== null ? Math.round(diffMs / 60000) : null;
    const expired  = diffMs !== null && diffMs < 0;
    const urgent   = diffMs !== null && diffMs >= 0 && diffMs <= 15 * 60 * 1000;
    const soonish  = diffMs !== null && diffMs > 15 * 60 * 1000 && diffMs <= 60 * 60 * 1000;

    let badgeHtml = '';
    if (hasTime) {
      if (expired) {
        badgeHtml = `<span class="note-badge note-badge--expired">Expired</span>`;
      } else if (urgent) {
        badgeHtml = `<span class="note-badge note-badge--soon">⏰ ${diffMin}m</span>`;
      } else if (soonish) {
        badgeHtml = `<span class="note-badge note-badge--hour">~ ${Math.round(diffMs / 3600000 * 10) / 10}h</span>`;
      } else {
        badgeHtml = `<span class="note-badge note-badge--scheduled">${this._formatDatetime(note.datetime)}</span>`;
      }
    }

    return `
      <article class="note-card-rs ${expired ? 'note-card-rs--expired' : ''} ${urgent ? 'note-card-rs--urgent' : ''}">
        <div class="note-card-rs__top">
          <h3 class="note-card-rs__title">${this._esc(note.title)}</h3>
          <div class="note-card-rs__actions">
            <button class="note-card-rs__edit" data-id="${note.id}" aria-label="Edit">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z"/>
              </svg>
            </button>
            <button class="note-card-rs__delete" data-id="${note.id}" aria-label="Delete">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
                <line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/>
              </svg>
            </button>
          </div>
        </div>
        ${note.desc ? `<p class="note-card-rs__desc">${this._esc(note.desc)}</p>` : ''}
        <div class="note-card-rs__footer">
          ${badgeHtml}
          ${note.link ? `
            <a class="note-card-rs__link" href="${this._esc(note.link)}" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8"/>
                <path d="M8 1h3v3"/><line x1="11" y1="1" x2="5" y2="7"/>
              </svg>
              ${this._esc(this._shortUrl(note.link))}
            </a>
          ` : ''}
          <span class="note-card-rs__time">${this._timeAgo(note.createdAt)}</span>
        </div>
      </article>
    `;
  }

  /* ── Reminder System ── */

  _startReminderLoop() {
    this._checkReminders();
    this._reminderTimer = setInterval(() => this._checkReminders(), 30_000);
  }

  _checkReminders() {
    const now    = Date.now();
    const WINDOW = 15 * 60 * 1000;

    this._notes.forEach(note => {
      if (!note.datetime || this._notifiedIds.has(note.id)) return;
      const target = new Date(note.datetime).getTime();
      const diff   = target - now;
      if (diff >= 0 && diff <= WINDOW) {
        this._notifiedIds.add(note.id);
        this._save();
        this._fireReminder(note, Math.round(diff / 60000));
        this._render();
      }
    });
  }

  _fireReminder(note, minutesLeft) {
    const msg = minutesLeft <= 1
      ? `"${note.title}" is now!`
      : `"${note.title}" in ${minutesLeft} minutes`;

    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification('📝 Reminder', { body: msg });
      setTimeout(() => n.close(), 8000);
    }

    this._showToast(msg, note);
  }

  _showToast(msg, note) {
    const toast = document.createElement('div');
    toast.className = 'notes-toast';
    toast.innerHTML = `
      <div class="notes-toast__icon">📝</div>
      <div class="notes-toast__body">
        <p class="notes-toast__label">Reminder</p>
        <p class="notes-toast__msg">${this._esc(msg)}</p>
        ${note.link ? `<a class="notes-toast__link" href="${this._esc(note.link)}" target="_blank" rel="noopener noreferrer">Open →</a>` : ''}
      </div>
      <button class="notes-toast__close" aria-label="Dismiss">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/>
        </svg>
      </button>
    `;
    this._toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('notes-toast--visible'));

    const dismiss = () => {
      toast.classList.remove('notes-toast--visible');
      setTimeout(() => toast.remove(), 380);
    };
    toast.querySelector('.notes-toast__close').addEventListener('click', dismiss);
    setTimeout(dismiss, 8000);
  }

  _requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => Notification.requestPermission(), 4000);
    }
  }

  /* ── Helpers ── */

  _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  _shortUrl(url) {
    try {
      const u = new URL(url);
      const path = u.pathname !== '/' ? u.pathname.slice(0, 22) : '';
      return u.hostname + path;
    } catch { return url.slice(0, 28); }
  }

  _formatDatetime(dt) {
    try {
      return new Date(dt).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
    } catch { return dt; }
  }

  _timeAgo(ts) {
    const d = Date.now() - ts;
    if (d < 60_000)      return 'just now';
    if (d < 3_600_000)   return `${Math.round(d / 60_000)}m ago`;
    if (d < 86_400_000)  return `${Math.round(d / 3_600_000)}h ago`;
    return `${Math.round(d / 86_400_000)}d ago`;
  }

}
