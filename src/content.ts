// Helper to validate a base58 Solana address (strictly 32 to 44 characters, base58 alphabet)
function isValidSolanaAddress(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const clean = str.trim();
  if (clean.length < 32 || clean.length > 44) return false;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(clean)) return false;

  const lower = clean.toLowerCase();
  const blacklist = [
    'solana',
    'raydium',
    'pumpfun',
    'orca',
    'jupiter',
    'undefined',
    'null',
    'transaction',
    'signatures',
    'account',
  ];
  if (blacklist.some((b) => lower.includes(b))) return false;

  return true;
}

// Scrape CA specifically from sidebar / token overview / copy buttons on Axiom or DEX sites
function scrapeCAFromPage(): string | null {
  try {
    const isAxiom = window.location.hostname.includes('axiom');

    // 1. AXIOM SIDEBAR & TOKEN INFO PANEL SELECTORS
    const sidebarContainers = document.querySelectorAll(
      'aside, [data-testid*="sidebar"], [data-testid*="token-info"], [class*="sidebar"], [class*="token-info"], [class*="pair-info"], [class*="drawer"]'
    );

    for (const container of sidebarContainers) {
      const elements = container.querySelectorAll('button, a, span, div, p');
      for (const el of elements) {
        for (const attr of ['data-ca', 'data-address', 'data-mint', 'data-token', 'data-clipboard-text', 'data-value']) {
          const val = el.getAttribute(attr);
          if (val && isValidSolanaAddress(val)) return val;
        }
        const title = el.getAttribute('title') || el.getAttribute('aria-label') || '';
        if (isValidSolanaAddress(title)) return title;

        const text = (el as HTMLElement).innerText?.trim() || '';
        if (isValidSolanaAddress(text)) return text;
      }
    }

    // 2. CHECK COPY BUTTONS GLOBALLY ON PAGE
    const copyElements = document.querySelectorAll<HTMLElement>(
      '[data-clipboard-text], [data-copy], [aria-label*="copy" i], [title*="copy" i], button[title*="CA" i], button[aria-label*="CA" i]'
    );
    for (const el of copyElements) {
      for (const attr of ['data-clipboard-text', 'data-copy', 'data-ca', 'data-value', 'title', 'aria-label']) {
        const val = el.getAttribute(attr);
        if (val && isValidSolanaAddress(val)) return val;
      }
      const text = el.innerText?.trim() || '';
      if (isValidSolanaAddress(text)) return text;
    }

    // 3. CHECK EXPLORER / PUMP LINKS ON PAGE
    const explorerLinks = document.querySelectorAll<HTMLAnchorElement>(
      'a[href*="solscan.io/account/"], a[href*="solscan.io/token/"], a[href*="pump.fun/coin/"], a[href*="pump.fun/"], a[href*="dexscreener.com/solana/"], a[href*="birdeye.so/token/"]'
    );
    for (const link of explorerLinks) {
      const href = link.href || '';
      const parts = href.split('/').filter(Boolean);
      for (const p of parts) {
        const clean = p.split('?')[0].split('#')[0];
        if (isValidSolanaAddress(clean)) return clean;
      }
    }

    // 4. CHECK DATA ATTRIBUTES GLOBALLY
    const caElements = document.querySelectorAll(
      '[data-ca], [data-address], [data-mint], [data-token], [data-contract]'
    );
    for (const el of caElements) {
      for (const attr of ['data-ca', 'data-address', 'data-mint', 'data-token', 'data-contract']) {
        const val = el.getAttribute(attr);
        if (val && isValidSolanaAddress(val)) return val;
      }
    }

    // 5. IF NOT AXIOM, allow falling back to standard DEX URL path
    if (!isAxiom) {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      for (const part of pathParts) {
        if (isValidSolanaAddress(part)) return part;
      }
      const params = new URLSearchParams(window.location.search);
      for (const [_k, val] of params.entries()) {
        if (isValidSolanaAddress(val)) return val;
      }
    }
  } catch {}

  return null;
}

// Scrape live value directly from page DOM (the exact working logic)
function scrapeLiveNumberFromDOM(): number | null {
  try {
    const parseAmount = (str: string): number | null => {
      if (!str) return null;
      const match = str.match(/\$?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*([KkMmBb])?/i);
      if (match) {
        let num = parseFloat(match[1].replace(/,/g, ''));
        const mult = (match[2] || '').toUpperCase();
        if (mult === 'B') num *= 1e9;
        else if (mult === 'M') num *= 1e6;
        else if (mult === 'K') num *= 1e3;
        if (num > 0) return num;
      }
      return null;
    };

    // 1. Check title (with K/M/B multiplier support)
    const title = document.title || '';
    const titleMatch = title.match(/\$([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*([KkMmBb])?/i);
    if (titleMatch) {
      let num = parseFloat(titleMatch[1].replace(/,/g, ''));
      const mult = (titleMatch[2] || '').toUpperCase();
      if (mult === 'B') num *= 1e9;
      else if (mult === 'M') num *= 1e6;
      else if (mult === 'K') num *= 1e3;
      if (num > 0) return num;
    }

    // 2. Look for elements labeled specifically with Market Cap or MCap
    const spans = document.querySelectorAll<HTMLElement>('span, div, p');
    for (const span of spans) {
      const text = span.innerText?.trim() || '';
      if (/^(mcap|market cap)\s*[:]?$/i.test(text)) {
        const next = span.nextElementSibling as HTMLElement | null;
        if (next) {
          const val = parseAmount(next.innerText?.trim() || '');
          if (val) return val;
        }
        const parent = span.parentElement;
        if (parent) {
          const siblings = parent.querySelectorAll<HTMLElement>('span, div');
          for (const s of siblings) {
            if (s !== span) {
              const val = parseAmount(s.innerText?.trim() || '');
              if (val) return val;
            }
          }
        }
      }
    }

    // 3. Check live price/mcap specific containers (without generic .font-mono and excluding fee/impact widgets)
    const candidates = document.querySelectorAll<HTMLElement>(
      '[data-testid*="price" i], [data-testid*="mcap" i], [class*="price" i], [class*="Price" i], [class*="mcap" i], [class*="marketCap" i], [id*="price" i], [id*="mcap" i]'
    );
    const noiseFilter = /impact|change|fee|slip|%|pnl|sol|usdc|limit|trigger|balance|min|max|gas/i;
    for (const el of candidates) {
      if (el.children.length > 2) continue;
      const attrStr = `${el.className || ''} ${el.id || ''} ${el.getAttribute('data-testid') || ''}`;
      if (noiseFilter.test(attrStr)) continue;
      const text = el.innerText?.trim() || '';
      if (noiseFilter.test(text)) continue;
      if (text.startsWith('$') || /^(\$|mcap|price)/i.test(text)) {
        const val = parseAmount(text);
        if (val && val > 0) return val;
      }
    }
  } catch {}

  return null;
}

// Scrape liquidity from DOM (e.g., token header, "Liquidity:" labels, stat boxes)
function scrapeLiquidityFromDOM(): number | null {
  try {
    const parseAmount = (str: string): number | null => {
      if (!str) return null;
      // Match something like $12.5K, $123,456, 15.2K, $1.2M, etc.
      const match = str.match(/\$?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*([KkMmBb])?/i);
      if (match) {
        let val = parseFloat(match[1].replace(/,/g, ''));
        const mult = (match[2] || '').toUpperCase();
        if (mult === 'B') val *= 1e9;
        else if (mult === 'M') val *= 1e6;
        else if (mult === 'K') val *= 1e3;
        if (val > 0) return val;
      }
      return null;
    };

    const foundResults: { val: number; raw: string; source: string }[] = [];

    // Helper to add unique candidate
    const addCandidate = (val: number | null, raw: string, source: string) => {
      if (val !== null && val > 0) {
        foundResults.push({ val, raw, source });
      }
    };

    // 1. Look for elements containing "Liquidity" text (spans, divs, etc.)
    const allSpansAndEls = document.querySelectorAll<HTMLElement>('span, div, p, a, button');
    for (const el of allSpansAndEls) {
      const directText = el.innerText?.trim() || '';
      if (/^liq(uidity)?\s*[:]?$/i.test(directText) || /liq(uidity)?\s*:/i.test(directText)) {
        // Look at siblings or parent/child spans
        const next = el.nextElementSibling as HTMLElement | null;
        if (next) {
          addCandidate(parseAmount(next.innerText?.trim() || ''), next.innerText?.trim() || '', 'nextSibling');
        }

        // Look inside parent container for value spans
        const parent = el.parentElement;
        if (parent) {
          const spans = parent.querySelectorAll<HTMLElement>('span, div');
          for (const s of spans) {
            if (s !== el && !/liq(uidity)?/i.test(s.innerText || '')) {
              addCandidate(parseAmount(s.innerText?.trim() || ''), s.innerText?.trim() || '', 'parentSpans');
            }
          }
          // Also check text after colon in same container
          const pText = parent.innerText || '';
          const afterColon = pText.replace(/^.*?liq(uidity)?\s*[:\s]*/i, '');
          addCandidate(parseAmount(afterColon), afterColon, 'parentAfterColon');
        }
      }
    }

    // 2. Look for elements with "liquidity" in data-testid, class, aria-label, or id
    const specificEls = document.querySelectorAll<HTMLElement>(
      '[data-testid*="liquidity" i], [class*="liquidity" i], [id*="liquidity" i], [aria-label*="liquidity" i]'
    );
    for (const el of specificEls) {
      const text = el.innerText?.trim() || '';
      addCandidate(parseAmount(text), text, 'attrMatch');
    }

    // Filter to distinct values (or keep all detected numeric results in order of appearance)
    if (foundResults.length > 0) {
      // If there are 2 or more results, take the 2nd one as requested
      const chosen = foundResults.length >= 2 ? foundResults[1] : foundResults[0];
      return chosen.val;
    }
  } catch {}

  return null;
}

// Scrape 5m volume from DOM (specifically matching Axiom's pair summary card and generic fallbacks)
function scrape5mVolumeFromDOM(): number | null {
  try {
    const parseAmount = (str: string): number | null => {
      if (!str) return null;
      const match = str.match(/\$?\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*([KkMmBb])?/i);
      if (match) {
        let val = parseFloat(match[1].replace(/,/g, ''));
        const mult = (match[2] || '').toUpperCase();
        if (mult === 'B') val *= 1e9;
        else if (mult === 'M') val *= 1e6;
        else if (mult === 'K') val *= 1e3;
        if (val > 0) return val;
      }
      return null;
    };

    // 1. Direct match for Axiom's structure:
    // <div ...><span ...>5m Vol</span><span ...>$24.6K</span></div>
    const spans = document.querySelectorAll<HTMLElement>('span, div, p');
    for (const span of spans) {
      const text = span.innerText?.trim() || '';
      if (text.toLowerCase() === '5m vol') {
        // Next sibling span (as seen in Axiom's exact markup)
        const next = span.nextElementSibling as HTMLElement | null;
        if (next) {
          const val = parseAmount(next.innerText?.trim() || '');
          if (val) return val;
        }
        // Direct parent's sibling or child
        const parent = span.parentElement;
        if (parent) {
          const siblings = parent.querySelectorAll<HTMLElement>('span');
          for (const s of siblings) {
            if (s !== span) {
              const val = parseAmount(s.innerText?.trim() || '');
              if (val) return val;
            }
          }
        }
      }
    }

    // 2. Fallback for other variants ("5m Volume", "5m Vol: $X", etc.)
    for (const el of spans) {
      if (el.children.length > 3) continue;
      const text = el.innerText?.trim() || '';
      if (/^5m\s*vol(ume)?\b/i.test(text)) {
        const after = text.replace(/^5m\s*vol(ume)?[:\s]*/i, '');
        const val = parseAmount(after);
        if (val) return val;

        const next = el.nextElementSibling as HTMLElement | null;
        if (next) {
          const nextVal = parseAmount(next.innerText?.trim() || '');
          if (nextVal) return nextVal;
        }
      }
    }
  } catch {}

  return null;
}

// Scrape token logo / image directly from page DOM (Axiom header, pair header, token avatar)
function scrapeTokenImageFromDOM(): string | null {
  try {
    // 1. EXACT match for Axiom's token avatar container:
    // <div class="group/image ..."><img alt="..." src="https://...axiom-cdn.io/...webp">...</div>
    const axiomAvatarImg = document.querySelector<HTMLImageElement>(
      '.group\\/image img, [class*="group/image"] img, [class*="bg-backgroundSecondary"] img'
    );
    if (axiomAvatarImg) {
      const src = axiomAvatarImg.currentSrc || axiomAvatarImg.src;
      if (src && (src.includes('http') || src.startsWith('blob:'))) {
        return src;
      }
    }

    // 2. Check for any img hosted on axiom-cdn.io or token cdns
    const cdnImgs = document.querySelectorAll<HTMLImageElement>('img[src*="axiom-cdn.io"], img[src*="cf-ipfs"], img[src*="arweave"]');
    for (const img of cdnImgs) {
      const src = img.currentSrc || img.src;
      if (src) return src;
    }

    // 3. Look for token avatar / header images inside pair summary
    const candidates = document.querySelectorAll<HTMLImageElement>(
      'header img, [data-testid*="token-image" i] img, [data-testid*="token-logo" i] img, [class*="token-image" i], [class*="token-logo" i], [class*="avatar" i], [class*="token" i] img, [class*="pair" i] img'
    );
    for (const el of candidates) {
      const src = el.currentSrc || el.src;
      if (src && !src.includes('data:image/svg') && !src.endsWith('.svg') && !src.includes('axiom.trade/favicon')) {
        if (src.includes('http') || src.includes('ipfs') || src.includes('cf-ipfs') || src.includes('dexscreener')) {
          return src;
        }
      }
    }

    // 4. Check meta og:image or twitter:image on the page
    const ogImg = document.querySelector<HTMLMetaElement>('meta[property="og:image"], meta[name="twitter:image"]');
    if (ogImg && ogImg.content && !ogImg.content.includes('axiom-og-default')) {
      return ogImg.content;
    }
  } catch {}

  return null;
}

let lastReportedCA: string | null = null;
let lastReportedNum: number | null = null;
let lastReportedLiquidity: number | null = null;
let lastReportedVolume: number | null = null;
let lastReportedImage: string | null = null;
let lastBackgroundBroadcastTime = 0;

function broadcastTokenAndPrice(force = false) {
  // In background/hidden tabs, rate limit to once every 1000ms to conserve resources while keeping open bags updating
  if (document.hidden && !force) {
    const now = Date.now();
    if (now - lastBackgroundBroadcastTime < 1000) {
      return;
    }
  }

  const ca = scrapeCAFromPage() || lastReportedCA;
  const num = scrapeLiveNumberFromDOM() || lastReportedNum;
  const liq = scrapeLiquidityFromDOM() || lastReportedLiquidity;
  const vol = scrape5mVolumeFromDOM() || lastReportedVolume;
  const img = scrapeTokenImageFromDOM() || lastReportedImage;

  const caChanged = ca && ca !== lastReportedCA;
  const numChanged = num !== null && num > 0 && num !== lastReportedNum;
  const liqChanged = liq !== null && liq > 0 && liq !== lastReportedLiquidity;
  const volChanged = vol !== null && vol > 0 && vol !== lastReportedVolume;
  const imgChanged = img && img !== lastReportedImage;

  if (caChanged || numChanged || liqChanged || volChanged || imgChanged || force) {
    if (document.hidden) {
      lastBackgroundBroadcastTime = Date.now();
    }
    if (ca) lastReportedCA = ca;
    if (num !== null && num > 0) lastReportedNum = num;
    if (liq !== null && liq > 0) lastReportedLiquidity = liq;
    if (vol !== null && vol > 0) lastReportedVolume = vol;
    if (img) lastReportedImage = img;

    // Send the scraped numbers and image so the sidepanel can assign them cleanly
    const payload = {
      type: 'PRICE_TICK',
      mint: lastReportedCA || undefined,
      scrapedNumber: lastReportedNum || undefined,
      scrapedLiquidity: lastReportedLiquidity || undefined,
      scrapedVolume: lastReportedVolume || undefined,
      scrapedImage: lastReportedImage || undefined,
    };

    chrome.runtime.sendMessage(payload).catch(() => {});
  }
}

// 1. Run immediately on page load
broadcastTokenAndPrice(true);

// Broadcast immediately when user switches to this tab
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    broadcastTokenAndPrice(true);
  }
});

// 2. High-speed DOM MutationObserver with lightweight 120ms throttle to prevent CPU lag
let prevHref = window.location.href;
let mutationThrottleTimer: any = null;

const observer = new MutationObserver(() => {
  if (window.location.href !== prevHref) {
    prevHref = window.location.href;
    broadcastTokenAndPrice(true);
    return;
  }
  if (!mutationThrottleTimer) {
    mutationThrottleTimer = setTimeout(() => {
      mutationThrottleTimer = null;
      broadcastTokenAndPrice(false);
    }, 120);
  }
});

observer.observe(document.body || document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
});

// 3. Intercept SPA navigation
const origPushState = history.pushState;
history.pushState = function (...args) {
  origPushState.apply(this, args);
  setTimeout(() => broadcastTokenAndPrice(true), 50);
};

const origReplaceState = history.replaceState;
history.replaceState = function (...args) {
  origReplaceState.apply(this, args);
  setTimeout(() => broadcastTokenAndPrice(true), 50);
};

window.addEventListener('popstate', () => setTimeout(() => broadcastTokenAndPrice(true), 50));
window.addEventListener('hashchange', () => setTimeout(() => broadcastTokenAndPrice(true), 50));

// 4. Fallback interval for safety (runs every 600ms)
setInterval(() => {
  broadcastTokenAndPrice(false);
}, 600);

// 5. Direct query response from sidepanel
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req?.type === 'GET_CURRENT_TOKEN') {
    const ca = scrapeCAFromPage() || lastReportedCA;
    const num = scrapeLiveNumberFromDOM() || lastReportedNum;
    const liq = scrapeLiquidityFromDOM() || lastReportedLiquidity;
    const vol = scrape5mVolumeFromDOM() || lastReportedVolume;
    const img = scrapeTokenImageFromDOM() || lastReportedImage;

    if (ca) lastReportedCA = ca;
    if (num !== null && num > 0) lastReportedNum = num;
    if (liq !== null && liq > 0) lastReportedLiquidity = liq;
    if (vol !== null && vol > 0) lastReportedVolume = vol;
    if (img) lastReportedImage = img;

    sendResponse({
      mint: ca || null,
      scrapedNumber: num || null,
      scrapedLiquidity: liq || null,
      scrapedVolume: vol || null,
      scrapedImage: img || null,
    });
  }
});