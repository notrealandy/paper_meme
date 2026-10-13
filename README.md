<div align="center">

<img src="public/icons/icon128.png" alt="Paper Meme Logo" width="80" height="80" />

# PAPER MEME

### Realistic Solana meme coin paper trading simulator for axiom.trade

Practice trading without real capital, with actual DEX mechanics: price impact, liquidity curves, priority fee competition, dropped transactions, and shareable PnL cards.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-00f59b?style=for-the-badge&logo=gnu&logoColor=black)](GNU_GPLv3-LICENSE)
[![Platform](https://img.shields.io/badge/Brave%20Sidebar-MV3-fb542b?style=for-the-badge&logo=brave&logoColor=white)](manifest.json)
[![Tech](https://img.shields.io/badge/Preact%20%7C%20TypeScript-Vite-00d4ff?style=for-the-badge&logo=typescript&logoColor=black)](package.json)
[![Google Antigravity](https://img.shields.io/badge/Google-Antigravity%20AI-a855f7?style=for-the-badge&logo=google&logoColor=white)](#built-with-ai-disclosure)

<br/>
<br/>

<img src="docs/assets/1.png" alt="Paper Meme in Action on axiom.trade" width="850" />

</div>

> [!WARNING]
> **Beta & Simulation Notice**  
> This project is in active development and might have occasional bugs or visual glitches. Because this extension is a 100% simulated sandbox, you do not connect any real Solana wallet or private keys. There is zero financial risk to your funds, but please expect minor quirks while features are being refined.

> [!NOTE]
> **Built with AI Disclosure**  
> This project was created and coded using AI assistance (Google DeepMind's Antigravity assistant) working together with [@notrealandy](https://github.com/notrealandy).

---

## What is it?

Most paper trading tools give you fake instant fills at exact market prices with zero fees, which gives you unrealistic expectations.

Paper Meme runs in your Brave sidebar while you browse axiom.trade. It automatically reads the token you are viewing and simulates realistic DEX conditions:

| Feature | Description |
| :--- | :--- |
| **AMM Price Impact** | Constant-product math recalculates execution prices based on actual quote liquidity pools. |
| **Priority Fee Simulator** | Low bribe tips risk delayed fills or getting dropped entirely during heavy volume candles. |
| **Multi-Wallet Sandbox** | Test independent scalping, holding, and degen bags without crossing balances or metrics. |
| **Shareable Stat Cards** | High-resolution graphic cards ready to download or copy directly to clipboard in one click. |

---

## Features

### 1. Terminal Trading Interface

Clean dark layout designed to sit in Brave's sidebar right next to your chart with live token data and rapid buy/sell controls.

<div align="center">
  <img src="docs/assets/5.png" alt="Terminal Trading Interface" width="500" />
</div>

- **Auto token detection:** picks up the token contract address straight from your active axiom.trade tab, or paste any Solana address manually.
- **Quick buy presets:** configure custom SOL amounts for one-click buys.
- **Real-time slippage estimates:** calculates price impact before orders go through.

---

### 2. Multiple Wallets

Run multiple isolated paper wallets with their own balances, open positions, and trade histories.

<div align="center">
  <img src="docs/assets/2.png" alt="Multi-Wallet Manager" width="500" />
</div>

- **Simulated Solana addresses:** creates random base58 public keys with a quick copy button.
- **Separate tracking:** balances, bags, and trade logs stay isolated per wallet.
- **Quick switching:** switch active wallet with one click from the header.
- **Rename and delete:** edit wallet names or remove old wallets directly in the popup.

---

### 3. Open Positions and Real-Time Tracking

Track active bags alongside charts with live unrealized PnL, entry multipliers, and instant bag scaling.

<div align="center">
  <img src="docs/assets/3.png" alt="Open Positions and Live Chart Tracking" width="850" />
</div>

- **Live valuations:** prices update continuously against DexScreener feeds.
- **Sell Initial:** sell only your initial invested amount and let the remaining tokens ride as house money.
- **Percentage sells:** sell 25%, 50%, 75%, or 100% of any position with one click.

---

### 4. Shareable PnL Cards

Create clean stat cards to share your trade results.

<div align="center">
  <img src="docs/assets/4.png" alt="Shareable Trade PnL Card" width="500" />
</div>

- **Two modes:** export cards for a single token trade or your whole wallet portfolio.
- **Currency toggle:** choose whether SOL or USD is the main highlighted number.
- **Trade details:** shows trade date range, token icon, and wallet name in all caps.
- **One-click export:** copy the card directly to your clipboard or download it as a PNG.

---

## Project Structure

```text
paper_meme/
├── src/
│   ├── app.tsx                 # Main application component and state
│   ├── WalletManagerModal.tsx  # Wallet switcher and import/export modal
│   ├── SharePnlModal.tsx       # Canvas card generator for PnL sharing
│   ├── background.ts           # Extension background service worker
│   └── content.ts              # Content script to read contract address from page
├── public/
│   └── icons/                  # Extension icons
├── manifest.json               # Manifest V3 extension configuration
└── vite.config.ts              # Vite + Preact build setup
```

---

## How to Install and Run

### 1. Build from Source

```bash
# Clone repository
git clone https://github.com/notrealandy/paper_meme.git
cd paper_meme

# Install dependencies & build extension
yarn install
yarn build
```

### 2. Load Extension in Brave (or Chrome)

1. Go to `brave://extensions/` (or `chrome://extensions/`) in your browser.
2. Turn on **Developer mode** in the top right.
3. Click **Load unpacked**.
4. Select the `dist` folder inside the `paper_meme` directory.
5. Open [axiom.trade](https://axiom.trade) and launch the extension from your sidebar or extensions menu.

### 3. Development Mode

```bash
yarn dev
```

---

## Backup and Export

All trade and wallet data is saved in your browser storage (`chrome.storage.local` and `localStorage`).

| Backup Option | Description |
| :--- | :--- |
| **Single Wallet Export** | Export individual wallet balances, positions, and trades to a single JSON file. |
| **Full Archive Backup** | Export all wallets, buy/sell presets, fees, and active configs in one file. |
| **Seamless Restore** | Import any previous JSON file to instantly restore your trading terminal state. |

---

## License

This project is licensed under the GNU General Public License v3.0. See the [GNU_GPLv3-LICENSE](GNU_GPLv3-LICENSE) file for details.
