import type { TrackedWallet, TrackerTradeEvent } from './TrackerView';

export const DEFAULT_SOLANA_RPC = 'https://solana-rpc.publicnode.com';
const FALLBACK_RPC = 'https://api.mainnet-beta.solana.com';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// Token info cache to prevent repeated DexScreener calls
const tokenInfoCache = new Map<string, { symbol: string; name: string; priceUsd: number }>();

export function getActiveRpcUrl(): string {
  try {
    const custom = localStorage.getItem('pm_custom_rpc');
    if (custom && custom.trim().startsWith('http')) {
      return custom.trim();
    }
  } catch {}
  return DEFAULT_SOLANA_RPC;
}

export function setActiveRpcUrl(url: string) {
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem('pm_custom_rpc');
    } else {
      localStorage.setItem('pm_custom_rpc', url.trim());
    }
  } catch {}
}

/**
 * Fetch latest transaction signatures for a given Solana wallet
 */
export async function fetchSignaturesForAddress(
  address: string,
  limit = 4,
  rpcUrl = getActiveRpcUrl()
): Promise<string[]> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [address, { limit }],
      }),
    });

    if (!res.ok) {
      if (rpcUrl !== FALLBACK_RPC) {
        return fetchSignaturesForAddress(address, limit, FALLBACK_RPC);
      }
      return [];
    }

    const data = await res.json();
    const result = data?.result;
    if (!Array.isArray(result)) return [];

    // Filter out failed transactions and extract signatures
    return result.filter((s: any) => !s.err).map((s: any) => s.signature);
  } catch (err) {
    if (rpcUrl !== FALLBACK_RPC) {
      return fetchSignaturesForAddress(address, limit, FALLBACK_RPC);
    }
    console.warn('Failed to fetch signatures for', address, err);
    return [];
  }
}

/**
 * Fetch parsed transaction details by signature
 */
export async function fetchParsedTransaction(
  signature: string,
  rpcUrl = getActiveRpcUrl()
): Promise<any | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          signature,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 1 },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.result || null;
  } catch (err) {
    console.warn('Failed to fetch parsed tx for signature', signature, err);
    return null;
  }
}

/**
 * Query DexScreener for token name, symbol, and price
 */
export async function fetchTokenMetadata(
  mint: string
): Promise<{ symbol: string; name: string; priceUsd: number }> {
  if (tokenInfoCache.has(mint)) {
    return tokenInfoCache.get(mint)!;
  }

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
    if (res.ok) {
      const data = await res.json();
      const pair = data?.pairs?.[0];
      if (pair?.baseToken) {
        const info = {
          symbol: pair.baseToken.symbol || mint.slice(0, 5).toUpperCase(),
          name: pair.baseToken.name || 'Solana Token',
          priceUsd: Number(pair.priceUsd) || 0,
        };
        tokenInfoCache.set(mint, info);
        return info;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch token metadata for mint', mint, err);
  }

  const fallback = {
    symbol: mint.slice(0, 4).toUpperCase(),
    name: 'Solana Token',
    priceUsd: 0,
  };
  tokenInfoCache.set(mint, fallback);
  return fallback;
}

/**
 * Parse a transaction to check if it represents a BUY or SELL for the tracked wallet
 */
export async function parseTransactionForWallet(
  tx: any,
  signature: string,
  wallet: TrackedWallet,
  solPriceUsd = 180
): Promise<TrackerTradeEvent | null> {
  if (!tx || !tx.meta || tx.meta.err) return null;

  const targetAddr = wallet.address.toLowerCase();
  const preTokens = tx.meta.preTokenBalances || [];
  const postTokens = tx.meta.postTokenBalances || [];

  // 1. Check for token balance differences for this wallet
  const preMap = new Map<string, number>();
  for (const b of preTokens) {
    if (b.owner && b.owner.toLowerCase() === targetAddr) {
      preMap.set(b.mint, b.uiTokenAmount?.uiAmount || 0);
    }
  }

  const postMap = new Map<string, number>();
  for (const b of postTokens) {
    if (b.owner && b.owner.toLowerCase() === targetAddr) {
      postMap.set(b.mint, b.uiTokenAmount?.uiAmount || 0);
    }
  }

  const allMints = new Set<string>([...preMap.keys(), ...postMap.keys()]);
  allMints.delete(WSOL_MINT);

  let targetMint = '';
  let tokenDelta = 0;

  for (const mint of allMints) {
    const pre = preMap.get(mint) || 0;
    const post = postMap.get(mint) || 0;
    const diff = post - pre;
    if (Math.abs(diff) > 0.000001) {
      targetMint = mint;
      tokenDelta = diff;
      break;
    }
  }

  // Fallback: If owner wasn't indexed directly on the token balance, check accountKeys
  if (!targetMint) {
    for (const b of postTokens) {
      if (b.mint && b.mint !== WSOL_MINT) {
        const preEntry = preTokens.find((p: any) => p.accountIndex === b.accountIndex);
        const preAmt = preEntry?.uiTokenAmount?.uiAmount || 0;
        const postAmt = b.uiTokenAmount?.uiAmount || 0;
        if (postAmt !== preAmt) {
          targetMint = b.mint;
          tokenDelta = postAmt - preAmt;
          break;
        }
      }
    }
  }

  if (!targetMint) {
    return null; // Not a token trade transaction
  }

  const type: 'BUY' | 'SELL' = tokenDelta > 0 ? 'BUY' : 'SELL';

  // 2. Determine SOL spent or received
  let solSpent = 0;
  const accountKeys = tx.transaction?.message?.accountKeys || [];
  const walletIdx = accountKeys.findIndex((k: any) => {
    const pub = typeof k === 'string' ? k : k?.pubkey;
    return pub && pub.toLowerCase() === targetAddr;
  });

  if (walletIdx !== -1 && tx.meta.preBalances && tx.meta.postBalances) {
    const preSol = (tx.meta.preBalances[walletIdx] || 0) / 1e9;
    const postSol = (tx.meta.postBalances[walletIdx] || 0) / 1e9;
    solSpent = Math.abs(preSol - postSol);
  }

  // Check WSOL delta as fallback if native SOL delta is very small (wrapped swap)
  const preWsol = preMap.get(WSOL_MINT) || 0;
  const postWsol = postMap.get(WSOL_MINT) || 0;
  const wsolDiff = Math.abs(postWsol - preWsol);
  if (wsolDiff > 0.001) {
    solSpent = Math.max(solSpent, wsolDiff);
  }

  // Clean sol amount
  if (solSpent < 0.001) {
    solSpent = 0.05; // Fallback minimum
  }

  // 3. Fetch token info from DexScreener
  const tokenInfo = await fetchTokenMetadata(targetMint);
  const amountUsd = Number((solSpent * (solPriceUsd || 180)).toFixed(2));
  const timestamp = tx.blockTime ? tx.blockTime * 1000 : Date.now();

  return {
    id: `ev-${signature}`,
    walletAddress: wallet.address,
    walletNickname: wallet.nickname,
    walletEmoji: wallet.emoji || '🐋',
    walletColor: wallet.color || '#00F59B',
    type,
    tokenSymbol: tokenInfo.symbol,
    tokenName: tokenInfo.name,
    mint: targetMint,
    amountSol: Number(solSpent.toFixed(3)),
    amountUsd,
    timestamp,
    priceUsd: tokenInfo.priceUsd,
    isTest: false,
  };
}
