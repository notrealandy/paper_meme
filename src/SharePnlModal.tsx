import { useEffect, useRef, useState } from 'preact/hooks';

export interface ShareTokenData {
  type?: 'TOKEN';
  mint: string;
  symbol: string;
  totalBoughtUsd: number;
  totalBoughtTokens: number;
  totalSoldUsd: number;
  totalSoldTokens: number;
  realizedPnl: number;
  totalPnl: number;
  holdingTokens: number;
  holdingUsd: number;
  solPriceUsd: number;
  firstBuyTimestamp?: number;
  lastSellTimestamp?: number;
}

export interface ShareWalletData {
  type: 'WALLET';
  totalPnlUsd: number;
  totalPnlSol: number;
  totalPnlPct: number;
  netWorthSol: number;
  netWorthUsd: number;
  startingBalance: number;
  winRate: number;
  winTradesCount: number;
  lossTradesCount: number;
  profitFactor: number;
  totalRealizedPnl: number;
  totalVolume: number;
  totalBuysCount: number;
  totalSellsCount: number;
  openPositionsCount: number;
  firstTradeTimestamp?: number;
  lastTradeTimestamp?: number;
  solPriceUsd: number;
  walletName?: string;
}

export type SharePnlData = ShareTokenData | ShareWalletData;

interface SharePnlModalProps {
  data: SharePnlData | null;
  onClose: () => void;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1e9) return `${(tokens / 1e9).toFixed(2)}B`;
  if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(2)}M`;
  if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(2)}K`;
  return tokens.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

export function SharePnlModal({ data, onClose }: SharePnlModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [heroCurrency, setHeroCurrency] = useState<'USD' | 'SOL'>('USD');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    if (!data) return;

    let isCancelled = false;
    setIsGenerating(true);

    const renderCard = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = 900;
      const H = 500;
      canvas.width = W;
      canvas.height = H;

      const isWallet = data.type === 'WALLET';
      const solRate = data.solPriceUsd || 150;

      const totalPnl = isWallet ? data.totalPnlUsd : data.totalPnl;
      const pnlSol = isWallet ? data.totalPnlSol : data.totalPnl / solRate;
      const pnlPct = isWallet
        ? data.totalPnlPct
        : data.totalBoughtUsd > 0
        ? (data.totalPnl / data.totalBoughtUsd) * 100
        : 0;

      const isProfit = totalPnl >= 0;
      const pnlColor = isProfit ? '#00f59b' : '#ff4d4d';
      const pnlSign = isProfit ? '+' : '';

      // 1. Deep Obsidian Background
      ctx.fillStyle = '#080a0f';
      ctx.fillRect(0, 0, W, H);

      // 2. Modern Mesh Radial Glow
      const glowGrad = ctx.createRadialGradient(W / 2, 100, 10, W / 2, 100, 420);
      if (isProfit) {
        glowGrad.addColorStop(0, 'rgba(0, 245, 155, 0.16)');
        glowGrad.addColorStop(0.45, 'rgba(0, 245, 155, 0.04)');
        glowGrad.addColorStop(1, 'rgba(8, 10, 15, 0)');
      } else {
        glowGrad.addColorStop(0, 'rgba(255, 77, 77, 0.16)');
        glowGrad.addColorStop(0.45, 'rgba(255, 77, 77, 0.04)');
        glowGrad.addColorStop(1, 'rgba(8, 10, 15, 0)');
      }
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle tech background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      for (let x = 60; x < W; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 60; y < H; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Outer Rounded Border
      drawRoundedRect(ctx, 2, 2, W - 4, H - 4, 22);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 3. Top Bar: Extension Logo + Brand Name + Solana Status Pill
      let extIconImg: HTMLImageElement | null = null;
      try {
        const iconPath = typeof chrome !== 'undefined' && chrome?.runtime?.getURL
          ? chrome.runtime.getURL('icons/icon128.png')
          : '/icons/icon128.png';
        const img = new Image();
        img.src = iconPath;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
        });
        extIconImg = img;
      } catch {
        // Fallback to vector squircle
      }

      const iconX = 45;
      const iconY = 32;
      const iconSize = 34;

      if (extIconImg) {
        ctx.save();
        drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 9);
        ctx.clip();
        ctx.drawImage(extIconImg, iconX, iconY, iconSize, iconSize);
        ctx.restore();
      } else {
        // Fallback vector logo
        drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 9);
        ctx.fillStyle = '#101520';
        ctx.fill();
        ctx.strokeStyle = '#00FFA3';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#00FFA3';
        ctx.font = '900 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', iconX + iconSize / 2, iconY + iconSize / 2);
      }

      // Border on extension icon
      drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 9);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Green 'PAPER' box right next to the logo
      const paperPillX = iconX + iconSize + 10;
      const paperPillY = iconY + (iconSize - 24) / 2;
      const paperPillW = 62;
      const paperPillH = 24;
      drawRoundedRect(ctx, paperPillX, paperPillY, paperPillW, paperPillH, 6);
      ctx.fillStyle = 'rgba(0, 245, 155, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 245, 155, 0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#00f59b';
      ctx.font = '800 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAPER', paperPillX + paperPillW / 2, paperPillY + paperPillH / 2);

      // Top Right: Minimalist Trade Timing & Colorful Solana Logo
      const solLogoSize = 24;
      const solLogoX = W - 45 - solLogoSize;
      const solLogoY = iconY + (iconSize - solLogoSize) / 2;

      // Date metadata next to Solana logo (Day of first trade -> current day, no time)
      const firstTimestamp = isWallet ? data.firstTradeTimestamp : data.firstBuyTimestamp;
      const today = new Date();
      const startDate = firstTimestamp ? new Date(firstTimestamp) : today;

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const startStr = `${months[startDate.getMonth()]} ${startDate.getDate()}`;
      const todayStr = `${months[today.getMonth()]} ${today.getDate()}`;
      const yearStr = today.getFullYear();

      const isSameDate = startDate.toDateString() === today.toDateString();
      const dateText = isSameDate
        ? `${todayStr}, ${yearStr}`
        : `${startStr} → ${todayStr}, ${yearStr}`;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '600 11px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(dateText, solLogoX - 12, iconY + iconSize / 2);

      ctx.save();
      ctx.translate(solLogoX, solLogoY);
      ctx.scale(solLogoSize / 16, solLogoSize / 16);
      const solGrad = ctx.createLinearGradient(1.78, 13.33, 13.97, 1.14);
      solGrad.addColorStop(0, '#9945FF');
      solGrad.addColorStop(0.24, '#8752F3');
      solGrad.addColorStop(0.465, '#5497D5');
      solGrad.addColorStop(0.6, '#43B4CA');
      solGrad.addColorStop(0.735, '#28E0B9');
      solGrad.addColorStop(1, '#19FB9B');
      ctx.fillStyle = solGrad;
      const solPath = new Path2D(
        'M2.44955 6.75999H12.0395C12.1595 6.75999 12.2695 6.80999 12.3595 6.89999L13.8795 8.45999C14.1595 8.74999 13.9595 9.23999 13.5595 9.23999H3.96955C3.84955 9.23999 3.73955 9.18999 3.64955 9.09999L2.12955 7.53999C1.84955 7.24999 2.04955 6.75999 2.44955 6.75999ZM2.12955 4.68999L3.64955 3.12999C3.72955 3.03999 3.84955 2.98999 3.96955 2.98999H13.5495C13.9495 2.98999 14.1495 3.47999 13.8695 3.76999L12.3595 5.32999C12.2795 5.41999 12.1595 5.46999 12.0395 5.46999H2.44955C2.04955 5.46999 1.84955 4.97999 2.12955 4.68999ZM13.8695 11.3L12.3495 12.86C12.2595 12.95 12.1495 13 12.0295 13H2.44955C2.04955 13 1.84955 12.51 2.12955 12.22L3.64955 10.66C3.72955 10.57 3.84955 10.52 3.96955 10.52H13.5495C13.9495 10.52 14.1495 11.01 13.8695 11.3Z'
      );
      ctx.fill(solPath);
      ctx.restore();

      // 4. Hero Identity Header (Token Hero vs. Wallet Scorecard)
      const avatarX = 45;
      const avatarY = 92;
      const avatarSize = 52;

      if (!isWallet) {
        // Token Avatar
        let avatarImage: HTMLImageElement | null = null;
        const avatarUrls = [
          `https://axiomtrading-v2.axiom-cdn.io/${data.mint}.webp`,
          `https://cdn.dexscreener.com/token-images/og/solana/${data.mint}`,
        ];

        for (const url of avatarUrls) {
          try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const blob = await res.blob();
            const objUrl = URL.createObjectURL(blob);
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject();
              img.src = objUrl;
            });
            avatarImage = img;
            break;
          } catch {
            // fallback
          }
        }

        if (isCancelled) return;

        if (avatarImage) {
          ctx.save();
          drawRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 14);
          ctx.clip();
          ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
          ctx.restore();
        } else {
          drawRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 14);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = '800 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(data.symbol.slice(0, 1).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
        }

        drawRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 14);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`$${data.symbol}`, avatarX + avatarSize + 14, avatarY + 28);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '600 13px monospace';
        const shortMint = `${data.mint.slice(0, 6)}...${data.mint.slice(-6)}`;
        ctx.fillText(shortMint, avatarX + avatarSize + 14, avatarY + 46);
      } else {
        // Wallet / Portfolio Scorecard Emblem
        drawRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 14);
        ctx.fillStyle = 'rgba(0, 245, 155, 0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 245, 155, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Minimalist Wallet glyph
        ctx.save();
        ctx.translate(avatarX + avatarSize / 2, avatarY + avatarSize / 2);
        ctx.strokeStyle = '#00f59b';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        drawRoundedRect(ctx, -12, -9, 24, 18, 3);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(4, 0, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#00f59b';
        ctx.fill();
        ctx.restore();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const displayWalletTitle = (data.walletName || 'MAIN WALLET').toUpperCase();
        ctx.fillText(displayWalletTitle, avatarX + avatarSize + 14, avatarY + 28);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '600 13px monospace';
        const walletSub = `${data.winTradesCount + data.lossTradesCount} closed · ${data.openPositionsCount} active tokens · ${data.totalBuysCount + data.totalSellsCount} fills`;
        ctx.fillText(walletSub, avatarX + avatarSize + 14, avatarY + 46);
      }

      // 5. Giant Centerpiece Hero Display (USD or SOL is Biggest)
      ctx.textAlign = 'center';

      // Top label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const heroLabel = isWallet ? 'PORTFOLIO NET RETURN' : 'NET REALIZED & UNREALIZED PNL';
      ctx.fillText(heroLabel, W / 2, 175);

      const heroText = heroCurrency === 'USD'
        ? `${pnlSign}$${Math.abs(totalPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `${pnlSign}${pnlSol.toFixed(2)} SOL`;

      // Giant Hero Number
      ctx.save();
      ctx.shadowColor = isProfit ? 'rgba(0, 245, 155, 0.45)' : 'rgba(255, 77, 77, 0.45)';
      ctx.shadowBlur = 24;
      ctx.fillStyle = pnlColor;
      ctx.font = '900 66px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(heroText, W / 2, 238);
      ctx.restore();

      // Sub-Hero Line: Counterpart Currency + Percentage Badge
      const subValue = heroCurrency === 'USD'
        ? `${pnlSign}${pnlSol.toFixed(2)} SOL`
        : `${pnlSign}$${Math.abs(totalPnl).toFixed(2)} USD`;
      const roiText = `${pnlSign}${pnlPct.toFixed(1)}%`;

      ctx.fillStyle = isProfit ? '#a7f3d0' : '#fca5a5';
      ctx.font = '700 19px monospace';
      const subWidth = ctx.measureText(subValue).width;

      ctx.font = '800 12px monospace';
      const roiWidth = ctx.measureText(roiText).width;

      const gap = 16;
      const pillPadX = 10;
      const pillW = roiWidth + pillPadX * 2;
      const pillH = 24;
      const totalHeroRowW = subWidth + gap + pillW;
      const startX = (W - totalHeroRowW) / 2;

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isProfit ? '#a7f3d0' : '#fca5a5';
      ctx.font = '700 19px monospace';
      ctx.fillText(subValue, startX, 276);

      // Percentage pill badge
      const pillX = startX + subWidth + gap;
      const pillY = 264;
      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 6);
      ctx.fillStyle = isProfit ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 77, 77, 0.15)';
      ctx.fill();
      ctx.strokeStyle = isProfit ? 'rgba(0, 245, 155, 0.4)' : 'rgba(255, 77, 77, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = pnlColor;
      ctx.font = '800 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(roiText, pillX + pillW / 2, pillY + pillH / 2);

      // 6. Metrics Summary Pill Card: 4 Columns
      const cardX = 45;
      const cardY = 320;
      const cardW = W - 90;
      const cardH = 98;
      const colW = cardW / 4;

      drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 14);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cardX + i * colW, cardY + 14);
        ctx.lineTo(cardX + i * colW, cardY + cardH - 14);
        ctx.stroke();
      }

      ctx.textBaseline = 'alphabetic';

      if (!isWallet) {
        // Token Metrics
        // Col 1: Bought
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('TOTAL BOUGHT', cardX + colW * 0.5, cardY + 28);
        ctx.fillStyle = '#00f59b';
        ctx.font = '800 18px monospace';
        ctx.fillText(`$${data.totalBoughtUsd.toFixed(1)}`, cardX + colW * 0.5, cardY + 56);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '600 11px monospace';
        ctx.fillText(`${(data.totalBoughtUsd / solRate).toFixed(2)} SOL`, cardX + colW * 0.5, cardY + 78);

        // Col 2: Sold
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('TOTAL SOLD', cardX + colW * 1.5, cardY + 28);
        ctx.fillStyle = '#ff4d4d';
        ctx.font = '800 18px monospace';
        ctx.fillText(`$${data.totalSoldUsd.toFixed(1)}`, cardX + colW * 1.5, cardY + 56);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '600 11px monospace';
        ctx.fillText(`${(data.totalSoldUsd / solRate).toFixed(2)} SOL`, cardX + colW * 1.5, cardY + 78);

        // Col 3: Holding
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('HOLDING', cardX + colW * 2.5, cardY + 28);
        ctx.fillStyle = (data.holdingTokens || 0) > 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
        ctx.font = '800 18px monospace';
        ctx.fillText((data.holdingTokens || 0) > 0 ? formatTokens(data.holdingTokens) : '0', cardX + colW * 2.5, cardY + 56);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '600 11px monospace';
        ctx.fillText((data.holdingTokens || 0) > 0 ? `$${(data.holdingUsd || 0).toFixed(1)}` : 'Closed', cardX + colW * 2.5, cardY + 78);

        // Col 4: Realized PnL
        const realizedProfit = data.realizedPnl >= 0;
        const realizedColor = realizedProfit ? '#00f59b' : '#ff4d4d';
        const realizedSign = realizedProfit ? '+' : '';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('REALIZED PNL', cardX + colW * 3.5, cardY + 28);
        ctx.fillStyle = realizedColor;
        ctx.font = '800 18px monospace';
        ctx.fillText(`${realizedSign}$${Math.abs(data.realizedPnl).toFixed(2)}`, cardX + colW * 3.5, cardY + 56);
        ctx.fillStyle = realizedColor;
        ctx.font = '600 11px monospace';
        ctx.fillText(`${realizedSign}${(data.realizedPnl / solRate).toFixed(2)} SOL`, cardX + colW * 3.5, cardY + 78);
      } else {
        // Wallet Metrics
        // Col 1: Win Rate
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('WIN RATE', cardX + colW * 0.5, cardY + 28);
        ctx.fillStyle = data.winRate >= 50 ? '#00f59b' : data.winTradesCount + data.lossTradesCount === 0 ? '#ffffff' : '#ff4d4d';
        ctx.font = '800 18px monospace';
        ctx.fillText(`${data.winRate.toFixed(1)}%`, cardX + colW * 0.5, cardY + 56);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '600 11px monospace';
        ctx.fillText(`${data.winTradesCount}W - ${data.lossTradesCount}L`, cardX + colW * 0.5, cardY + 78);

        // Col 2: Profit Factor
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('PROFIT FACTOR', cardX + colW * 1.5, cardY + 28);
        ctx.fillStyle = data.profitFactor >= 1.5 ? '#00f59b' : data.profitFactor >= 1 ? '#8ba2ff' : '#ff4d4d';
        ctx.font = '800 18px monospace';
        ctx.fillText(data.profitFactor >= 99 ? '∞' : data.profitFactor.toFixed(2), cardX + colW * 1.5, cardY + 56);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '600 11px monospace';
        ctx.fillText('Gain / Loss Ratio', cardX + colW * 1.5, cardY + 78);

        // Col 3: Net Worth
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('NET WORTH', cardX + colW * 2.5, cardY + 28);
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 18px monospace';
        ctx.fillText(`${data.netWorthSol.toFixed(2)} SOL`, cardX + colW * 2.5, cardY + 56);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '600 11px monospace';
        ctx.fillText(`≈ $${data.netWorthUsd.toFixed(0)}`, cardX + colW * 2.5, cardY + 78);

        // Col 4: Realized PnL
        const realizedProfit = data.totalRealizedPnl >= 0;
        const realizedColor = realizedProfit ? '#00f59b' : '#ff4d4d';
        const realizedSign = realizedProfit ? '+' : '';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('REALIZED PNL', cardX + colW * 3.5, cardY + 28);
        ctx.fillStyle = realizedColor;
        ctx.font = '800 18px monospace';
        ctx.fillText(`${realizedSign}$${Math.abs(data.totalRealizedPnl).toFixed(2)}`, cardX + colW * 3.5, cardY + 56);
        ctx.fillStyle = realizedColor;
        ctx.font = '600 11px monospace';
        ctx.fillText(`${realizedSign}${(data.totalRealizedPnl / solRate).toFixed(2)} SOL`, cardX + colW * 3.5, cardY + 78);
      }

      // 7. Footer Watermark
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('on axiom.trade', 45, 465);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '700 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('SIMULATED TRADING', W - 45, 465);

      setIsGenerating(false);
    };

    renderCard();

    return () => {
      isCancelled = true;
    };
  }, [data, heroCurrency]);

  if (!data) return null;

  const isWallet = data.type === 'WALLET';

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = isWallet
      ? 'paper-portfolio-stats.png'
      : `${data.symbol.toLowerCase()}-paper-pnl.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopy = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch (e) {
      console.error('Failed to copy image to clipboard', e);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'linear-gradient(180deg, #131722 0%, #0c0e15 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          borderRadius: 14,
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          animation: 'fadeIn 0.15s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Currency Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>
              {isWallet ? 'Share Portfolio Stats' : 'Share Trade Card'}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'rgba(0, 245, 155, 0.12)',
                color: 'var(--accent-green)',
                fontFamily: 'monospace',
              }}
            >
              {isWallet ? 'WALLET' : `$${data.symbol}`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Currency Mode Selector */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: 6,
                padding: 2,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                onClick={() => setHeroCurrency('USD')}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  background: heroCurrency === 'USD' ? 'var(--accent-green)' : 'transparent',
                  color: heroCurrency === 'USD' ? '#06080d' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                USD
              </button>
              <button
                onClick={() => setHeroCurrency('SOL')}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  background: heroCurrency === 'SOL' ? 'var(--accent-green)' : 'transparent',
                  color: heroCurrency === 'SOL' ? '#06080d' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                SOL
              </button>
            </div>

            <button
              onClick={onClose}
              title="Close"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Card Canvas Preview */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            borderRadius: 10,
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: '#080a0f',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
          />
          {isGenerating && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(8, 10, 15, 0.75)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Rendering card...
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Download Button */}
          <button
            onClick={handleDownload}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 0',
              background: 'var(--accent-green)',
              color: '#06080d',
              border: 'none',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e: any) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e: any) => (e.currentTarget.style.opacity = '1')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download Image</span>
          </button>

          {/* Copy Image Button */}
          <button
            onClick={handleCopy}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 0',
              background: copied ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 255, 255, 0.06)',
              color: copied ? 'var(--accent-green)' : '#fff',
              border: copied ? '1px solid rgba(0, 245, 155, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {copied ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy Image</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
