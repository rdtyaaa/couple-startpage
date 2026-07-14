/**
 * BackgroundManager
 * Manages background gradients with architecture prepared for
 * time-of-day × weather condition matrix.
 */
export class BackgroundManager {
  /** @param {HTMLElement} element - the #background element */
  constructor(element) {
    this._el = element;
    this._currentCondition = 'default';
    this._override = null;
  }

  /**
   * Initialize with the default gradient.
   */
  init() {
    this._apply(this._getGradient('default'));
  }

  /**
   * Update background based on time period and weather condition.
   * Ignored when an override is active.
   * @param {string} timePeriod - 'morning' | 'afternoon' | 'evening' | 'night'
   * @param {string} weatherCondition - 'sunny' | 'cloudy' | 'rain' | etc.
   */
  update(timePeriod = 'default', weatherCondition = 'default') {
    const key = `${timePeriod}_${weatherCondition}`;
    this._currentCondition = key;
    if (!this._override) {
      this._apply(this._getGradient(key));
    }
  }

  /**
   * Set a theme override gradient (ThemeManager calls this).
   * @param {string} gradient - CSS gradient string
   */
  setOverride(gradient) {
    this._override = gradient;
    this._apply(gradient);
  }

  /**
   * Clear the theme override and restore the ambient gradient.
   */
  clearOverride() {
    this._override = null;
    this._apply(this._getGradient(this._currentCondition));
  }

  /**
   * Get the gradient for a given condition key.
   * Architecture prepared for future unique gradients per condition.
   * @param {string} _key
   * @returns {string} CSS gradient value
   */
  _getGradient(_key) {
    return `
      radial-gradient(ellipse at 20% 0%, rgba(60, 30, 90, 0.15) 0%, transparent 55%),
      radial-gradient(ellipse at 80% 100%, rgba(20, 40, 80, 0.12) 0%, transparent 50%),
      radial-gradient(ellipse at 50% 50%, rgba(25, 25, 45, 0.3) 0%, transparent 70%),
      linear-gradient(160deg, #08080e 0%, #0e0e1c 30%, #141428 55%, #0f0f1e 80%, #0a0a14 100%)
    `;
  }

  /**
   * Apply a gradient to the background element.
   * @param {string} gradient
   */
  _apply(gradient) {
    this._el.style.background = gradient;
  }
}
