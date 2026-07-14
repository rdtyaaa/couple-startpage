/**
 * WeatherManager
 * Fetches weather from BMKG Public API and displays it in a compact glass card.
 */
export class WeatherManager {
  /**
   * @param {HTMLElement} cardElement - the #weather-card element
   * @param {string} adm4Code - BMKG ADM4 code from config
   * @param {function|null} onLoaded - callback(data) fired after weather loads
   */
  constructor(cardElement, adm4Code, onLoaded = null) {
    this._card = cardElement;
    this._adm4 = adm4Code;
    this._onLoaded = onLoaded;
  }

  /**
   * Initialize: fetch and display weather.
   */
  async init() {
    try {
      const data = await this._fetchWeather();
      if (data) {
        this._render(data);
      }
    } catch {
      /* Weather unavailable — hide card gracefully */
      this._card.style.display = 'none';
    }
  }

  /**
   * Fetch weather data from BMKG Public API.
   * @returns {Promise<object|null>}
   */
  async _fetchWeather() {
    const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${this._adm4}`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const json = await response.json();
    return this._parseWeather(json);
  }

  /**
   * Parse the BMKG API response to extract current weather.
   * @param {object} json
   * @returns {object|null}
   */
  _parseWeather(json) {
    try {
      const locationData = json.data?.[0];
      if (!locationData) return null;

      /* Flatten all forecast entries across all days */
      const allForecasts = locationData.cuaca?.flat() || [];
      if (allForecasts.length === 0) return null;

      /* Find the forecast closest to current time */
      const now = Date.now();
      let closest = allForecasts[0];
      let closestDiff = Infinity;

      for (const forecast of allForecasts) {
        const forecastTime = new Date(forecast.local_datetime || forecast.datetime).getTime();
        const diff = Math.abs(forecastTime - now);
        if (diff < closestDiff) {
          closestDiff = diff;
          closest = forecast;
        }
      }

      /* Extract location name */
      const location = locationData.lokasi;
      const locationName = location?.kotkab || location?.kecamatan || location?.provinsi || '';

      return {
        temperature: Math.round(closest.t ?? 0),
        description: closest.weather_desc_en || closest.weather_desc || '',
        weatherCode: closest.weather ?? 0,
        location: locationName.replace(/^KOTA\s+/i, ''),
        emoji: this._getWeatherEmoji(closest.weather ?? 0),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get weather emoji based on BMKG weather code.
   * @param {number} code
   * @returns {string}
   */
  _getWeatherEmoji(code) {
    const emojiMap = {
      0:  '☀️',   /* Clear Skies */
      1:  '⛅',   /* Partly Cloudy */
      2:  '⛅',   /* Partly Cloudy */
      3:  '☁️',   /* Mostly Cloudy */
      4:  '☁️',   /* Overcast */
      5:  '🌫️',  /* Haze */
      10: '🌫️',  /* Smoke */
      45: '🌫️',  /* Fog */
      60: '🌧️',  /* Light Rain */
      61: '🌧️',  /* Rain */
      63: '🌧️',  /* Heavy Rain */
      80: '🌦️',  /* Isolated Shower */
      95: '⛈️',  /* Thunderstorm */
      97: '⛈️',  /* Severe Thunderstorm */
    };
    return emojiMap[code] || '🌤️';
  }

  /**
   * Render weather data into the card.
   * @param {object} data
   */
  _render(data) {
    const emojiEl = this._card.querySelector('#weather-emoji');
    const tempEl = this._card.querySelector('#weather-temp');
    const descEl = this._card.querySelector('#weather-desc');
    const locEl = this._card.querySelector('#weather-location');

    if (emojiEl) emojiEl.textContent = data.emoji;
    if (tempEl) tempEl.textContent = `${data.temperature}°C`;
    if (descEl) descEl.textContent = data.description;
    if (locEl) locEl.textContent = data.location;

    this._card.classList.add('loaded');

    /* Notify callback (used by ThemeManager for weather-based themes) */
    if (this._onLoaded) this._onLoaded(data);
  }
}
