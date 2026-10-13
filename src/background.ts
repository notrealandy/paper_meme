chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

function extractMintFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // If on axiom.trade, the URL path is NOT the token CA, so ignore URL parsing
    if (parsed.hostname.includes('axiom')) {
      return null;
    }

    // 1. Check path segments (e.g. /trade/{address}, /token/{address}, /{address})
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    for (const part of pathParts) {
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(part)) {
        return part;
      }
    }

    // 2. Check query params (e.g. ?token={address}, ?address={address})
    for (const [_k, val] of parsed.searchParams.entries()) {
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val)) {
        return val;
      }
    }

    // 3. Check hash
    if (parsed.hash) {
      const hashParts = parsed.hash.split(/[\/?&=#]/).filter(Boolean);
      for (const part of hashParts) {
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(part)) {
          return part;
        }
      }
    }
  } catch {}
  return null;
}

// Listen for tab navigation & updates
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
    const mint = extractMintFromUrl(tab.url);
    if (mint) {
      chrome.storage.local.set({ activeToken: mint }).catch(() => {});
    }
  }
});

// Listen for tab switches
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    const mint = extractMintFromUrl(tab?.url);
    if (mint) {
      chrome.storage.local.set({ activeToken: mint }).catch(() => {});
    }
  });
});

// Relay runtime messages to persistent storage
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'TOKEN_CHANGED' && message.mint) {
    chrome.storage.local.set({ activeToken: message.mint }).catch(() => {});
  }
});