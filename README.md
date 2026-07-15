# 🌌 Premium Personalized Homepage

A calm, elegant, and feature-rich new tab experience built with Vanilla HTML, CSS, and JavaScript. Designed to start your day with everything you need at a glance, from weather and local market updates to a smart search bar.

## ✨ Features

- **Dynamic Greeting & Clock**: Personalized greeting based on the time of day alongside a clean, modern clock.
- **Local Market & Weather (Indonesia)**:
  - Real-time weather updates.
  - Live market prices including **Emas Pegadaian** and **IHSG (IDX Composite)**.
  - National holidays and important dates tracker.
- **Smart Search**: Built-in Google search with autocomplete and keyboard shortcuts (`Ctrl+K`).
- **Quick Links**: Fast access to your favorite websites.
- **Immersive Visuals**: Dark theme with beautiful canvas particle effects (rain, snow, hearts, fireworks).
- **Interactive UI**: A collapsible sidebar (toggle with `Alt+S`) and a floating letter bubble for notifications/messages.

## 🚀 Technologies Used

- **HTML5** & **CSS3** (Vanilla, customized for performance and aesthetics)
- **JavaScript (ES Modules)**
- **PowerShell**: Included `update-market.ps1` script for updating market data.

## 📦 Installation & Setup

This project can be used both as a standard website and as a native Chrome Extension. Data is fetched centrally from GitHub via jsDelivr CDN, so you only need to update the JSON files in this repository to update the app content without republishing the extension!

### Option A: Use as Chrome Extension (Recommended)

1. Clone this repository or download the ZIP:
   ```bash
   git clone https://github.com/rdtyaaa/couple-startpage.git
   ```
2. Open Google Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** and select the cloned folder.
5. Open a new tab! The start page will now appear automatically.

### Option B: Use as Website

1. Clone this repository:
   ```bash
   git clone https://github.com/rdtyaaa/couple-startpage.git
   ```
2. Open `index.html` in your browser (preferably using a local server like Live Server).
3. Set it as your browser's default New Tab page using a custom new tab extension if desired.

## 🔄 Updating Data

All content (config, greetings, quicklinks, themes, etc.) is stored in the `data/` directory. To update your start page:
1. Edit the respective JSON files in the `data/` folder.
2. Commit and push the changes to the `main` branch on GitHub.
3. Your extension/website will automatically fetch the latest data (it may take ~5-10 minutes for the CDN cache to update).

## ⌨️ Keyboard Shortcuts

- `Ctrl + K` : Focus search bar
- `Alt + S` : Toggle sidebar

## 📜 License

Distributed under the MIT License.
