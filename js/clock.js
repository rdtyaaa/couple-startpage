/**
 * ClockManager
 * Displays current time (HH:MM) and date, updating every second.
 */
export class ClockManager {
  /**
   * @param {HTMLElement} timeElement - the #clock-time element
   * @param {HTMLElement} dateElement - the #clock-date element
   */
  constructor(timeElement, dateElement) {
    this._timeEl = timeElement;
    this._dateEl = dateElement;
    this._intervalId = null;
  }

  /**
   * Initialize the clock and start ticking.
   */
  init() {
    this._update();
    this._intervalId = setInterval(() => this._update(), 1000);
  }

  /**
   * Stop the clock.
   */
  destroy() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  /**
   * Update the time and date display.
   */
  _update() {
    const now = new Date();
    this._timeEl.textContent = this._formatTime(now);
    this._dateEl.textContent = this._formatDate(now);
  }

  /**
   * Format time as HH:MM (24-hour).
   * @param {Date} date
   * @returns {string}
   */
  _formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Format date as "Day, Month Date, Year".
   * @param {Date} date
   * @returns {string}
   */
  _formatDate(date) {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    return date.toLocaleDateString('en-US', options);
  }
}
