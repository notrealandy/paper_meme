<div align="center">

<img src="public/icons/icon128.png" alt="Paper Meme Logo" width="80" height="80" />

# PAPER MEME

### Realistic Solana meme coin paper trading simulator for axiom.trade

Practice trading without real capital, with actual DEX mechanics: price impact, liquidity curves, priority fee competition, dropped transactions, and shareable PnL cards.

<div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 16px 0;">
  <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(0, 245, 155, 0.08); border: 1px solid rgba(0, 245, 155, 0.25); border-radius: 6px; font-family: monospace; font-size: 11px; font-weight: 700; color: #00f59b;">
    <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/gnu.svg" width="13" height="13" style="filter: invert(72%) sepia(90%) saturate(3000%) hue-rotate(100deg); display: inline-block;" alt="GNU" />
    GPL v3.0
  </span>
  <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(251, 84, 43, 0.08); border: 1px solid rgba(251, 84, 43, 0.28); border-radius: 6px; font-family: monospace; font-size: 11px; font-weight: 700; color: #fb542b;">
    <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/brave.svg" width="13" height="13" style="filter: invert(47%) sepia(85%) saturate(2400%) hue-rotate(345deg); display: inline-block;" alt="Brave" />
    Brave Sidebar · MV3
  </span>
  <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 6px; font-family: monospace; font-size: 11px; font-weight: 700; color: #e2e8f0;">
    <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/preact.svg" width="13" height="13" style="filter: invert(40%) sepia(80%) saturate(1500%) hue-rotate(220deg); display: inline-block;" alt="Preact" />
    <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/typescript.svg" width="12" height="12" style="filter: invert(45%) sepia(80%) saturate(2000%) hue-rotate(190deg); display: inline-block;" alt="TypeScript" />
    Preact · TypeScript · Vite
  </span>
  <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 6px; font-family: monospace; font-size: 11px; font-weight: 700; color: #c084fc;">
    <img src="https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/google.svg" width="12" height="12" style="filter: invert(65%) sepia(60%) saturate(2000%) hue-rotate(240deg); display: inline-block;" alt="Google DeepMind" />
    Google Antigravity
  </span>
</div>

<div align="center" style="margin: 20px 0;">
  <img src="docs/assets/1.png" alt="Paper Meme in Action on axiom.trade" width="850" style="border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 100%; height: auto;" />
</div>

</div>

<div style="background-color: #2b2510; border: 1px solid #d29922; border-left: 5px solid #e3b341; border-radius: 8px; padding: 14px 18px; margin: 20px 0; color: #f0e6c8; font-size: 13.5px; line-height: 1.5;">
  <strong style="color: #f1e05a; font-size: 14.5px; display: block; margin-bottom: 4px;">Beta & Simulation Notice</strong>
  This project is in active development and might have occasional bugs or visual glitches. Because this extension is a 100% simulated sandbox, you do not connect any real Solana wallet or private keys. There is zero financial risk to your funds, but please expect minor quirks while features are being refined.
</div>

<div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
  <div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
    Built with AI Disclosure
  </div>
  <div style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
    This project was created and coded using AI assistance (Google DeepMind's Antigravity assistant) working together with <a href="https://github.com/notrealandy" style="color: #00f59b; text-decoration: none; font-weight: 600;">@notrealandy</a>.
  </div>
</div>

---

## What is it?

Most paper trading tools give you fake instant fills at exact market prices with zero fees, which gives you unrealistic expectations.

Paper Meme runs in your Brave sidebar while you browse axiom.trade. It automatically reads the token you are viewing and simulates realistic DEX conditions:

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin: 16px 0;">
  <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px 14px;">
    <div style="color: #00f59b; font-family: monospace; font-size: 12px; font-weight: 700; margin-bottom: 4px;">AMM Price Impact</div>
    <div style="color: #94a3b8; font-size: 12.5px; line-height: 1.4;">Constant-product math recalculates execution prices based on actual quote liquidity pools.</div>
  </div>
  <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px 14px;">
    <div style="color: #00d4ff; font-family: monospace; font-size: 12px; font-weight: 700; margin-bottom: 4px;">Priority Fee Simulator</div>
    <div style="color: #94a3b8; font-size: 12.5px; line-height: 1.4;">Low bribe tips risk delayed fills or getting dropped entirely during heavy volume candles.</div>
  </div>
  <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px 14px;">
    <div style="color: #fb542b; font-family: monospace; font-size: 12px; font-weight: 700; margin-bottom: 4px;">Multi-Wallet Sandbox</div>
    <div style="color: #94a3b8; font-size: 12.5px; line-height: 1.4;">Test independent scalping, holding, and degen bags without crossing balances or metrics.</div>
  </div>
  <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px 14px;">
    <div style="color: #e2e8f0; font-family: monospace; font-size: 12px; font-weight: 700; margin-bottom: 4px;">Shareable Stat Cards</div>
    <div style="color: #94a3b8; font-size: 12.5px; line-height: 1.4;">High-resolution graphic cards ready to download or copy directly to clipboard in one click.</div>
  </div>
</div>

---

## Features

### 1. Terminal Trading Interface

Clean dark layout designed to sit in Brave's sidebar right next to your chart with live token data and rapid buy/sell controls.

<div align="center" style="margin: 18px 0;">
  <img src="docs/assets/5.png" alt="Terminal Trading Interface" width="480" style="border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
</div>

<div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
  <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px; line-height: 1.8;">
    <li><strong style="color: #fff;">Auto token detection:</strong> picks up the token contract address straight from your active axiom.trade tab, or paste any Solana address manually.</li>
    <li><strong style="color: #fff;">Quick buy presets:</strong> configure custom SOL amounts for one-click buys.</li>
    <li><strong style="color: #fff;">Real-time slippage estimates:</strong> calculates price impact before orders go through.</li>
  </ul>
</div>

---

### 2. Multiple Wallets

Run multiple isolated paper wallets with their own balances, open positions, and trade histories.

<div align="center" style="margin: 18px 0;">
  <img src="docs/assets/2.png" alt="Multi-Wallet Manager" width="480" style="border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
</div>

<div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
  <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px; line-height: 1.8;">
    <li><strong style="color: #fff;">Simulated Solana addresses:</strong> creates random base58 public keys with a quick copy button.</li>
    <li><strong style="color: #fff;">Separate tracking:</strong> balances, bags, and trade logs stay isolated per wallet.</li>
    <li><strong style="color: #fff;">Quick switching:</strong> switch active wallet with one click from the header.</li>
    <li><strong style="color: #fff;">Rename and delete:</strong> edit wallet names or remove old wallets directly in the popup.</li>
  </ul>
</div>

---

### 3. Open Positions and Real-Time Tracking

Track active bags alongside charts with live unrealized PnL, entry multipliers, and instant bag scaling.

<div align="center" style="margin: 18px 0;">
  <img src="docs/assets/3.png" alt="Open Positions and Live Chart Tracking" width="850" style="border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
</div>

<div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
  <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px; line-height: 1.8;">
    <li><strong style="color: #fff;">Live valuations:</strong> prices update continuously against DexScreener feeds.</li>
    <li><strong style="color: #fff;">Sell Initial:</strong> sell only your initial invested amount and let the remaining tokens ride as house money.</li>
    <li><strong style="color: #fff;">Percentage sells:</strong> sell 25%, 50%, 75%, or 100% of any position with one click.</li>
  </ul>
</div>

---

### 4. Shareable PnL Cards

Create clean stat cards to share your trade results.

<div align="center" style="margin: 18px 0;">
  <img src="docs/assets/4.png" alt="Shareable Trade PnL Card" width="480" style="border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
</div>

<div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
  <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px; line-height: 1.8;">
    <li><strong style="color: #fff;">Two modes:</strong> export cards for a single token trade or your whole wallet portfolio.</li>
    <li><strong style="color: #fff;">Currency toggle:</strong> choose whether SOL or USD is the main highlighted number.</li>
    <li><strong style="color: #fff;">Trade details:</strong> shows trade date range, token icon, and wallet name in all caps.</li>
    <li><strong style="color: #fff;">One-click export:</strong> copy the card directly to your clipboard or download it as a PNG.</li>
  </ul>
</div>

---

## Project Structure

<div style="background: #0d1117; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 14px 18px; margin: 16px 0; font-family: monospace; font-size: 12.5px; line-height: 1.6; color: #94a3b8;">
  <span style="color: #00f59b; font-weight: 700;">paper_meme/</span><br/>
  ├── <span style="color: #00d4ff;">src/</span><br/>
  │   ├── <span style="color: #fff;">app.tsx</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748b;"># Main application component and state</span><br/>
  │   ├── <span style="color: #fff;">WalletManagerModal.tsx</span> &nbsp;<span style="color: #64748b;"># Wallet switcher and import/export modal</span><br/>
  │   ├── <span style="color: #fff;">SharePnlModal.tsx</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748b;"># Canvas card generator for PnL sharing</span><br/>
  │   ├── <span style="color: #fff;">background.ts</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748b;"># Extension background service worker</span><br/>
  │   └── <span style="color: #fff;">content.ts</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748b;"># Content script to read contract address from page</span><br/>
  ├── <span style="color: #00d4ff;">public/</span><br/>
  │   └── <span style="color: #fff;">icons/</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748b;"># Extension icons</span><br/>
  ├── <span style="color: #fff;">manifest.json</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748b;"># Manifest V3 extension configuration</span><br/>
  └── <span style="color: #fff;">vite.config.ts</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color: #64748b;"># Vite + Preact build setup</span>
</div>

---

## How to Install and Run

### 1. Build from Source

<div style="background: #0b0e14; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden; margin: 12px 0;">
  <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
    <div style="display: flex; gap: 6px;">
      <span style="width: 9px; height: 9px; border-radius: 50%; background: rgba(255, 95, 87, 0.6); display: inline-block;"></span>
      <span style="width: 9px; height: 9px; border-radius: 50%; background: rgba(254, 188, 46, 0.6); display: inline-block;"></span>
      <span style="width: 9px; height: 9px; border-radius: 50%; background: rgba(40, 200, 64, 0.6); display: inline-block;"></span>
    </div>
    <span style="font-family: monospace; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">bash / zsh</span>
  </div>
  <div style="padding: 14px 16px; font-family: monospace; font-size: 12.5px; line-height: 1.7; color: #e2e8f0;">
    <span style="color: #64748b;"># 1. Clone repository</span><br/>
    <span style="color: #00d4ff;">git</span> clone https://github.com/notrealandy/paper_meme.git<br/>
    <span style="color: #00d4ff;">cd</span> paper_meme<br/><br/>
    <span style="color: #64748b;"># 2. Install dependencies & build extension</span><br/>
    <span style="color: #00f59b;">yarn</span> install<br/>
    <span style="color: #00f59b;">yarn</span> build
  </div>
</div>

### 2. Load Extension in Brave (or Chrome)

<div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 14px 18px; margin: 12px 0;">
  <ol style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 13px; line-height: 1.8;">
    <li>Go to <code style="background: rgba(255, 255, 255, 0.08); padding: 2px 6px; border-radius: 4px; color: #00f59b;">brave://extensions/</code> (or <code style="background: rgba(255, 255, 255, 0.08); padding: 2px 6px; border-radius: 4px; color: #00d4ff;">chrome://extensions/</code>) in your browser.</li>
    <li>Turn on <strong style="color: #fff;">Developer mode</strong> in the top right.</li>
    <li>Click <strong style="color: #fff;">Load unpacked</strong>.</li>
    <li>Select the <code style="background: rgba(255, 255, 255, 0.08); padding: 2px 6px; border-radius: 4px; color: #e2e8f0;">dist</code> folder inside the <code style="background: rgba(255, 255, 255, 0.08); padding: 2px 6px; border-radius: 4px; color: #e2e8f0;">paper_meme</code> directory.</li>
    <li>Open <a href="https://axiom.trade" style="color: #00f59b; text-decoration: none;">axiom.trade</a> and launch the extension from your sidebar or extensions menu.</li>
  </ol>
</div>

### 3. Development Mode

<div style="background: #0b0e14; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden; margin: 12px 0;">
  <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 12px; background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
    <span style="font-family: monospace; font-size: 11px; color: #94a3b8;">Live watcher with auto-rebuild:</span>
    <span style="font-family: monospace; font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">terminal</span>
  </div>
  <div style="padding: 12px 16px; font-family: monospace; font-size: 13px; color: #e2e8f0;">
    <span style="color: #00f59b; font-weight: 700;">yarn</span> dev
  </div>
</div>

---

## Backup and Export

All trade and wallet data is saved in your browser storage (`chrome.storage.local` and `localStorage`).

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin: 14px 0;">
  <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px 14px;">
    <div style="color: #00d4ff; font-family: monospace; font-size: 12px; font-weight: 700; margin-bottom: 4px;">Single Wallet Export</div>
    <div style="color: #94a3b8; font-size: 12px; line-height: 1.4;">Export individual wallet balances, positions, and trades to a single JSON file.</div>
  </div>
  <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px 14px;">
    <div style="color: #00f59b; font-family: monospace; font-size: 12px; font-weight: 700; margin-bottom: 4px;">Full Archive Backup</div>
    <div style="color: #94a3b8; font-size: 12px; line-height: 1.4;">Export all wallets, buy/sell presets, fees, and active configs in one file.</div>
  </div>
  <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px 14px;">
    <div style="color: #fb542b; font-family: monospace; font-size: 12px; font-weight: 700; margin-bottom: 4px;">Seamless Restore</div>
    <div style="color: #94a3b8; font-size: 12px; line-height: 1.4;">Import any previous JSON file to instantly restore your trading terminal state.</div>
  </div>
</div>
 
---

## License

This project is licensed under the GNU General Public License v3.0. See the [GNU_GPLv3-LICENSE](GNU_GPLv3-LICENSE) file for details.
