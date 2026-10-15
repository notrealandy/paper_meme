import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { SharePnlModal, type SharePnlData } from './SharePnlModal';
import {
  WalletManagerModal,
  generateSimulatedSolanaAddress,
  type WalletAccount,
} from './WalletManagerModal';
import {
  TrackerView,
  formatMarketCap,
  formatTokenAmount,
  type TrackerTradeEvent,
} from './TrackerView';

interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    symbol: string;
  };
  priceUsd: string;
  priceNative?: string;
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h24?: number;
    h1?: number;
    m5?: number;
  };
  liquidity?: {
    usd?: number;
  };
  fdv?: number;
  marketCap?: number;
  txns?: {
    h24?: { buys: number; sells: number };
    m5?: { buys: number; sells: number };
  };
  info?: {
    imageUrl?: string;
    header?: string;
    websites?: Array<{ label: string; url: string }>;
    socials?: Array<{ type: string; url: string }>;
  };
}

interface Position {
  mint: string;
  symbol: string;
  name: string;
  entryPrice: number;
  tokens: number;
  investedUsd: number;
  createdAt: number;
}

interface TradeLog {
  id: string;
  timestamp: number;
  mint: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  amountUsd: number;
  tokens: number;
  price: number;
  effectivePrice?: number;
  feeUsd?: number;
  priceImpactPct?: number;
  realizedPnl?: number;
}

interface BuyPresetGroup {
  id: string;
  name: string;
  amounts: number[];
}

const DEFAULT_PRESET_GROUPS: BuyPresetGroup[] = [
  { id: 'standard', name: 'Standard', amounts: [0.1, 0.25, 0.5, 1, 2] },
  { id: 'micro', name: 'Micro', amounts: [0.05, 0.1, 0.2, 0.5, 1] },
  { id: 'ape', name: 'Ape', amounts: [0.5, 1, 2.5, 5, 10] },
];

interface SellPresetGroup {
  id: string;
  name: string;
  percentages: number[];
}

const DEFAULT_SELL_PRESET_GROUPS: SellPresetGroup[] = [
  { id: 'standard', name: 'Standard', percentages: [25, 50, 75, 100] },
  { id: 'scalp', name: 'Scalp', percentages: [10, 20, 33, 50] },
  { id: 'moon', name: 'Moon', percentages: [50, 69, 90, 100] },
];

// Format currency numbers nicely (K, M, B) with 1 decimal
function formatCompact(num?: number): string {
  if (num === undefined || num === null || isNaN(num) || num <= 0) return '---';
  // If the number is already formatted in raw thousands from trading terminal (e.g., 20 or 20.4 representing $20.4k)
  if (num < 1000) {
    return `$${num.toFixed(1)}K`;
  }
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toFixed(1)}`;
}

// Format token price with high precision for microcaps
function formatPrice(price: number): string {
  if (!price || price <= 0) return '$0.00';
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  if (price >= 0.001) return `$${price.toFixed(4)}`;
  if (price >= 0.00001) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(8)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1e9) return `${(tokens / 1e9).toFixed(2)}B`;
  if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(2)}M`;
  if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(2)}K`;
  return tokens.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function App() {
  // Multiple Wallets Management - canonical wallets list
  const [wallets, setWallets] = useState<WalletAccount[]>(() => {
    try {
      const saved = localStorage.getItem('pm_wallets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    let initBal = 10;
    const savedBal = localStorage.getItem('pm_balance_sol');
    if (savedBal) initBal = parseFloat(savedBal) || 10;

    let initStartBal = initBal;
    const savedStartBal = localStorage.getItem('pm_starting_balance_sol');
    if (savedStartBal) initStartBal = parseFloat(savedStartBal) || initBal;

    let initPos: Record<string, Position> = {};
    try {
      const savedPos = localStorage.getItem('pm_positions');
      if (savedPos) initPos = JSON.parse(savedPos) || {};
    } catch {}

    let initTrades: TradeLog[] = [];
    try {
      const savedTrades = localStorage.getItem('pm_trades');
      if (savedTrades) initTrades = JSON.parse(savedTrades) || [];
    } catch {}

    return [
      {
        id: 'w_default',
        name: 'Main Wallet',
        address: generateSimulatedSolanaAddress(),
        balance: initBal,
        startingBalance: initStartBal,
        positions: initPos,
        tradeHistory: initTrades,
        createdAt: Date.now(),
      },
    ];
  });

  const [activeWalletId, setActiveWalletId] = useState<string>(() => {
    return localStorage.getItem('pm_active_wallet_id') || 'w_default';
  });

  const [showWalletManager, setShowWalletManager] = useState<boolean>(false);

  const activeWallet = useMemo(() => {
    return wallets.find((w) => w.id === activeWalletId) || wallets[0];
  }, [wallets, activeWalletId]);

  // Persistent Virtual Balance held natively in SOL (derived from active wallet)
  const [balance, setBalance] = useState<number>(() => {
    try {
      const savedWallets = localStorage.getItem('pm_wallets');
      const activeId = localStorage.getItem('pm_active_wallet_id') || 'w_default';
      if (savedWallets) {
        const parsed = JSON.parse(savedWallets);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const matched = parsed.find((w: any) => w.id === activeId) || parsed[0];
          if (matched && typeof matched.balance === 'number') return matched.balance;
        }
      }
    } catch {}
    const saved = localStorage.getItem('pm_balance_sol');
    if (saved) return parseFloat(saved);
    const oldUsd = localStorage.getItem('pm_balance');
    if (oldUsd) {
      const num = parseFloat(oldUsd);
      const converted = Math.round((num / 150) * 1000) / 1000;
      return converted > 0 ? converted : 10;
    }
    return 10;
  });

  // Starting balance preference in SOL
  const [startingBalance, setStartingBalance] = useState<number>(() => {
    try {
      const savedWallets = localStorage.getItem('pm_wallets');
      const activeId = localStorage.getItem('pm_active_wallet_id') || 'w_default';
      if (savedWallets) {
        const parsed = JSON.parse(savedWallets);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const matched = parsed.find((w: any) => w.id === activeId) || parsed[0];
          if (matched && typeof matched.startingBalance === 'number') return matched.startingBalance;
        }
      }
    } catch {}
    const saved = localStorage.getItem('pm_starting_balance_sol');
    if (saved) return parseFloat(saved);
    const oldUsd = localStorage.getItem('pm_starting_balance');
    if (oldUsd) {
      const num = parseFloat(oldUsd);
      return Math.round((num / 150) * 100) / 100;
    }
    return 10;
  });

  const [showBalanceModal, setShowBalanceModal] = useState<boolean>(false);
  const [customBalanceInput, setCustomBalanceInput] = useState<string>('10');

  // Persistent Positions per mint: { [mint]: Position }
  const [positions, setPositions] = useState<Record<string, Position>>(() => {
    try {
      const savedWallets = localStorage.getItem('pm_wallets');
      const activeId = localStorage.getItem('pm_active_wallet_id') || 'w_default';
      if (savedWallets) {
        const parsed = JSON.parse(savedWallets);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const matched = parsed.find((w: any) => w.id === activeId) || parsed[0];
          if (matched && matched.positions) return matched.positions;
        }
      }
    } catch {}
    try {
      const saved = localStorage.getItem('pm_positions');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persistent Trade History
  const [tradeHistory, setTradeHistory] = useState<TradeLog[]>(() => {
    try {
      const savedWallets = localStorage.getItem('pm_wallets');
      const activeId = localStorage.getItem('pm_active_wallet_id') || 'w_default';
      if (savedWallets) {
        const parsed = JSON.parse(savedWallets);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const matched = parsed.find((w: any) => w.id === activeId) || parsed[0];
          if (matched && Array.isArray(matched.tradeHistory)) return matched.tradeHistory;
        }
      }
    } catch {}
    try {
      const saved = localStorage.getItem('pm_trades');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Active token mint & metadata
  const [mint, setMint] = useState<string>('');
  const [pairData, setPairData] = useState<DexPair | null>(null);
  const [price, setPrice] = useState<number>(0);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [manualMintInput, setManualMintInput] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [isHoveringImage, setIsHoveringImage] = useState<boolean>(false);
  const [scrapedData, setScrapedData] = useState<{
    mint?: string;
    symbol?: string;
    name?: string;
    price?: number;
    marketCap?: number;
    imageUrl?: string;
  } | null>(null);
  const [liveMarketCap, setLiveMarketCap] = useState<number | null>(null);
  const [liveLiquidity, setLiveLiquidity] = useState<number | null>(null);
  const [liveVolume, setLiveVolume] = useState<number | null>(null);

  // Live prices for open positions across all browser tabs / DexScreener { [mint]: priceUsd }
  const [positionPrices, setPositionPrices] = useState<Record<string, number>>({});
  const positionPricesRef = useRef<Record<string, number>>({});
  const positionsRef = useRef<Record<string, Position>>(positions);
  const tradeHistoryRef = useRef<TradeLog[]>(tradeHistory);
  const balanceRef = useRef<number>(balance);
  const startingBalanceRef = useRef<number>(startingBalance);
  const walletsRef = useRef<WalletAccount[]>(wallets);
  const activeWalletIdRef = useRef<string>(activeWalletId);
  const isStorageSyncingRef = useRef<boolean>(false);
  const isSwitchingWalletRef = useRef<boolean>(false);
  const lastDexFetchRef = useRef<number>(0);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  useEffect(() => {
    tradeHistoryRef.current = tradeHistory;
  }, [tradeHistory]);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    startingBalanceRef.current = startingBalance;
  }, [startingBalance]);

  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  useEffect(() => {
    activeWalletIdRef.current = activeWalletId;
  }, [activeWalletId]);

  // Live SOL/USD price tracking (default fallback to 150)
  const [solPriceUsd, setSolPriceUsd] = useState<number>(() => {
    const saved = localStorage.getItem('pm_sol_price');
    return saved ? parseFloat(saved) : 150;
  });

  // Trading panel state (denominated in SOL)
  const [customAmount, setCustomAmount] = useState<string>('0.5');
  const [sellPercent, setSellPercent] = useState<number>(50);
  const [slippage, setSlippage] = useState<string>(() => {
    return localStorage.getItem('pm_slippage') || '1.0%';
  });
  const [customSlippageInput, setCustomSlippageInput] = useState<string>('');
  const [showCustomSlippage, setShowCustomSlippage] = useState<boolean>(false);
  const [priorityFee, setPriorityFee] = useState<string>(() => {
    return localStorage.getItem('pm_priority_fee') || '0.005';
  });
  const [customFeeInput, setCustomFeeInput] = useState<string>('');
  const [showFeeModal, setShowFeeModal] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'TRADE' | 'TRACKER' | 'HISTORY'>('TRADE');
  const [unreadTrackerCount, setUnreadTrackerCount] = useState<number>(0);
  const currentAppTabRef = useRef<'TRADE' | 'TRACKER' | 'HISTORY'>('TRADE');
  useEffect(() => {
    currentAppTabRef.current = activeTab;
  }, [activeTab]);
  const [showPositionsPopup, setShowPositionsPopup] = useState<boolean>(false);
  const [isPositionsPopupClosing, setIsPositionsPopupClosing] = useState<boolean>(false);

  const closePositionsPopup = () => {
    if (isPositionsPopupClosing) return;
    setIsPositionsPopupClosing(true);
    setTimeout(() => {
      setShowPositionsPopup(false);
      setIsPositionsPopupClosing(false);
    }, 180);
  };

  const togglePositionsPopup = () => {
    if (showPositionsPopup) {
      closePositionsPopup();
    } else {
      setIsPositionsPopupClosing(false);
      setShowPositionsPopup(true);
    }
  };

  const [fillsModalMint, setFillsModalMint] = useState<string | null>(null);
  const [shareModalData, setShareModalData] = useState<SharePnlData | null>(null);
  const [toastNotification, setToastNotification] = useState<{
    id: number;
    message: string;
    tradeEvent?: TrackerTradeEvent;
    duration: number;
    type?: 'success' | 'info' | 'warn' | 'error';
  } | null>(null);
  const [toastProgress, setToastProgress] = useState<number>(100);
  const [isToastHovered, setIsToastHovered] = useState<boolean>(false);
  const toastTimeoutRef = useRef<any>(null);
  const toastIntervalRef = useRef<any>(null);
  const toastStartTimeRef = useRef<number>(0);
  const toastRemainingRef = useRef<number>(3000);
  const isToastHoveredRef = useRef<boolean>(false);
  const prevPriceRef = useRef<number>(0);
  const activeTabIdRef = useRef<number | null>(null);
  const mintRef = useRef<string>(mint);

  useEffect(() => {
    mintRef.current = mint;
  }, [mint]);

  // Buy Presets customization state (denominated in SOL)
  const [presetGroups, setPresetGroups] = useState<BuyPresetGroup[]>(() => {
    try {
      const saved = localStorage.getItem('pm_buy_preset_groups_sol') || localStorage.getItem('pm_buy_preset_groups');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If first item has USD-scale values (>= 5), convert them to SOL scale or use defaults
          const isUsdScale = parsed.some((g: any) => g.amounts?.some((a: number) => a >= 50));
          if (!isUsdScale) return parsed;
        }
      }
    } catch {}
    return DEFAULT_PRESET_GROUPS;
  });

  const [activeGroupId, setActiveGroupId] = useState<string>(() => {
    return localStorage.getItem('pm_active_preset_group_id') || 'standard';
  });

  const [showPresetModal, setShowPresetModal] = useState<boolean>(false);
  const [editingGroupId, setEditingGroupId] = useState<string>('standard');
  const [draftName, setDraftName] = useState<string>('');
  const [draftAmounts, setDraftAmounts] = useState<string[]>([]);

  const activePresetGroup = useMemo(() => {
    return presetGroups.find((g) => g.id === activeGroupId) || presetGroups[0] || DEFAULT_PRESET_GROUPS[0];
  }, [presetGroups, activeGroupId]);

  const editingGroup = useMemo(() => {
    return presetGroups.find((g) => g.id === editingGroupId) || presetGroups[0] || DEFAULT_PRESET_GROUPS[0];
  }, [presetGroups, editingGroupId]);

  useEffect(() => {
    if (editingGroup) {
      setDraftName(editingGroup.name);
      setDraftAmounts(editingGroup.amounts.map((a) => a.toString()));
    }
  }, [editingGroupId, showPresetModal]);

  // Sell Presets customization state
  const [sellPresetGroups, setSellPresetGroups] = useState<SellPresetGroup[]>(() => {
    try {
      const saved = localStorage.getItem('pm_sell_preset_groups');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_SELL_PRESET_GROUPS;
  });

  const [activeSellGroupId, setActiveSellGroupId] = useState<string>(() => {
    return localStorage.getItem('pm_active_sell_preset_group_id') || 'standard';
  });

  const [showSellPresetModal, setShowSellPresetModal] = useState<boolean>(false);
  const [editingSellGroupId, setEditingSellGroupId] = useState<string>('standard');
  const [draftSellName, setDraftSellName] = useState<string>('');
  const [draftSellPercentages, setDraftSellPercentages] = useState<string[]>([]);

  const activeSellPresetGroup = useMemo(() => {
    return sellPresetGroups.find((g) => g.id === activeSellGroupId) || sellPresetGroups[0] || DEFAULT_SELL_PRESET_GROUPS[0];
  }, [sellPresetGroups, activeSellGroupId]);

  const editingSellGroup = useMemo(() => {
    return sellPresetGroups.find((g) => g.id === editingSellGroupId) || sellPresetGroups[0] || DEFAULT_SELL_PRESET_GROUPS[0];
  }, [sellPresetGroups, editingSellGroupId]);

  useEffect(() => {
    if (editingSellGroup) {
      setDraftSellName(editingSellGroup.name);
      setDraftSellPercentages(editingSellGroup.percentages.map((p) => p.toString()));
    }
  }, [editingSellGroupId, showSellPresetModal]);

  // Cross-tab synchronization: keep balance, startingBalance, positions, trades, and wallets synced across all open extension panels
  useEffect(() => {
    if (typeof chrome === 'undefined') return;

    // 1. Initial hydration from canonical chrome.storage.local
    if (chrome.storage?.local) {
      chrome.storage.local.get(['pm_wallets', 'pm_active_wallet_id'], (res) => {
        if (chrome.runtime.lastError || !res || isSwitchingWalletRef.current) return;
        isStorageSyncingRef.current = true;

        let loadedWallets = walletsRef.current;
        if (Array.isArray(res.pm_wallets) && res.pm_wallets.length > 0) {
          loadedWallets = res.pm_wallets as WalletAccount[];
          walletsRef.current = loadedWallets;
          setWallets(loadedWallets);
        }

        let loadedActiveId = activeWalletIdRef.current;
        if (res.pm_active_wallet_id && loadedWallets.some((w) => w.id === res.pm_active_wallet_id)) {
          loadedActiveId = res.pm_active_wallet_id as string;
        } else if (!loadedWallets.some((w) => w.id === loadedActiveId) && loadedWallets[0]) {
          loadedActiveId = loadedWallets[0].id;
        }
        activeWalletIdRef.current = loadedActiveId;
        setActiveWalletId(loadedActiveId);

        const activeW = loadedWallets.find((w) => w.id === loadedActiveId) || loadedWallets[0];
        if (activeW) {
          balanceRef.current = activeW.balance;
          startingBalanceRef.current = activeW.startingBalance;
          positionsRef.current = activeW.positions || {};
          tradeHistoryRef.current = activeW.tradeHistory || [];

          setBalance(activeW.balance);
          setStartingBalance(activeW.startingBalance);
          setPositions(activeW.positions || {});
          setTradeHistory(activeW.tradeHistory || []);
        }

        setTimeout(() => {
          isStorageSyncingRef.current = false;
        }, 100);
      });
    }

    // 2. Real-time storage change listener
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== 'local' || isSwitchingWalletRef.current) return;

      if (changes.pm_wallets && Array.isArray(changes.pm_wallets.newValue)) {
        const newWallets = changes.pm_wallets.newValue as WalletAccount[];
        const currentJson = JSON.stringify(walletsRef.current);
        const newJson = JSON.stringify(newWallets);
        if (currentJson !== newJson) {
          isStorageSyncingRef.current = true;
          walletsRef.current = newWallets;
          setWallets(newWallets);

          const activeW = newWallets.find((w) => w.id === activeWalletIdRef.current);
          if (activeW) {
            if (activeW.balance !== balanceRef.current) {
              balanceRef.current = activeW.balance;
              setBalance(activeW.balance);
            }
            if (activeW.startingBalance !== startingBalanceRef.current) {
              startingBalanceRef.current = activeW.startingBalance;
              setStartingBalance(activeW.startingBalance);
            }
            if (JSON.stringify(activeW.positions || {}) !== JSON.stringify(positionsRef.current)) {
              positionsRef.current = activeW.positions || {};
              setPositions(activeW.positions || {});
            }
            if (JSON.stringify(activeW.tradeHistory || []) !== JSON.stringify(tradeHistoryRef.current)) {
              tradeHistoryRef.current = activeW.tradeHistory || [];
              setTradeHistory(activeW.tradeHistory || []);
            }
          }
          setTimeout(() => {
            isStorageSyncingRef.current = false;
          }, 100);
        }
      }

      if (changes.pm_active_wallet_id && changes.pm_active_wallet_id.newValue && changes.pm_active_wallet_id.newValue !== activeWalletIdRef.current) {
        const newId = changes.pm_active_wallet_id.newValue as string;
        const target = walletsRef.current.find((w) => w.id === newId);
        if (target) {
          isStorageSyncingRef.current = true;
          activeWalletIdRef.current = target.id;
          balanceRef.current = target.balance;
          startingBalanceRef.current = target.startingBalance;
          positionsRef.current = target.positions || {};
          tradeHistoryRef.current = target.tradeHistory || [];

          setActiveWalletId(target.id);
          setBalance(target.balance);
          setStartingBalance(target.startingBalance);
          setPositions(target.positions || {});
          setTradeHistory(target.tradeHistory || []);

          setTimeout(() => {
            isStorageSyncingRef.current = false;
          }, 100);
        }
      }
    };

    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    // 3. Native window storage event for instant cross-tab sync
    const handleWindowStorage = (e: StorageEvent) => {
      if (!e.newValue || isSwitchingWalletRef.current) return;
      if (e.key === 'pm_wallets') {
        try {
          const newWallets = JSON.parse(e.newValue);
          if (Array.isArray(newWallets)) {
            const currentJson = JSON.stringify(walletsRef.current);
            if (currentJson !== e.newValue) {
              isStorageSyncingRef.current = true;
              walletsRef.current = newWallets;
              setWallets(newWallets);

              const activeW = newWallets.find((w: WalletAccount) => w.id === activeWalletIdRef.current);
              if (activeW) {
                if (activeW.balance !== balanceRef.current) {
                  balanceRef.current = activeW.balance;
                  setBalance(activeW.balance);
                }
                if (activeW.startingBalance !== startingBalanceRef.current) {
                  startingBalanceRef.current = activeW.startingBalance;
                  setStartingBalance(activeW.startingBalance);
                }
                if (JSON.stringify(activeW.positions || {}) !== JSON.stringify(positionsRef.current)) {
                  positionsRef.current = activeW.positions || {};
                  setPositions(activeW.positions || {});
                }
                if (JSON.stringify(activeW.tradeHistory || []) !== JSON.stringify(tradeHistoryRef.current)) {
                  tradeHistoryRef.current = activeW.tradeHistory || [];
                  setTradeHistory(activeW.tradeHistory || []);
                }
              }
              setTimeout(() => {
                isStorageSyncingRef.current = false;
              }, 100);
            }
          }
        } catch {}
      } else if (e.key === 'pm_active_wallet_id' && e.newValue !== activeWalletIdRef.current) {
        const target = walletsRef.current.find((w) => w.id === e.newValue);
        if (target) {
          isStorageSyncingRef.current = true;
          activeWalletIdRef.current = target.id;
          balanceRef.current = target.balance;
          startingBalanceRef.current = target.startingBalance;
          positionsRef.current = target.positions || {};
          tradeHistoryRef.current = target.tradeHistory || [];

          setActiveWalletId(target.id);
          setBalance(target.balance);
          setStartingBalance(target.startingBalance);
          setPositions(target.positions || {});
          setTradeHistory(target.tradeHistory || []);

          setTimeout(() => {
            isStorageSyncingRef.current = false;
          }, 100);
        }
      }
    };
    window.addEventListener('storage', handleWindowStorage);

    return () => {
      if (chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      window.removeEventListener('storage', handleWindowStorage);
    };
  }, []);

  // Save balance and positions to localStorage and chrome.storage.local (guarded against echo writes and active wallet switching)
  useEffect(() => {
    balanceRef.current = balance;
    localStorage.setItem('pm_balance_sol', balance.toString());
    if (!isStorageSyncingRef.current && !isSwitchingWalletRef.current) {
      chrome.storage?.local?.set({ pm_balance_sol: balance }).catch(() => {});
    }
  }, [balance]);

  useEffect(() => {
    startingBalanceRef.current = startingBalance;
    localStorage.setItem('pm_starting_balance_sol', startingBalance.toString());
    if (!isStorageSyncingRef.current && !isSwitchingWalletRef.current) {
      chrome.storage?.local?.set({ pm_starting_balance_sol: startingBalance }).catch(() => {});
    }
  }, [startingBalance]);

  useEffect(() => {
    positionsRef.current = positions;
    localStorage.setItem('pm_positions', JSON.stringify(positions));
    if (!isStorageSyncingRef.current && !isSwitchingWalletRef.current) {
      chrome.storage?.local?.set({ pm_positions: positions }).catch(() => {});
    }
  }, [positions]);

  useEffect(() => {
    tradeHistoryRef.current = tradeHistory;
    localStorage.setItem('pm_trades', JSON.stringify(tradeHistory));
    if (!isStorageSyncingRef.current && !isSwitchingWalletRef.current) {
      chrome.storage?.local?.set({ pm_trades: tradeHistory }).catch(() => {});
    }
  }, [tradeHistory]);

  useEffect(() => {
    localStorage.setItem('pm_buy_preset_groups', JSON.stringify(presetGroups));
  }, [presetGroups]);

  useEffect(() => {
    localStorage.setItem('pm_active_preset_group_id', activeGroupId);
  }, [activeGroupId]);

  useEffect(() => {
    localStorage.setItem('pm_sell_preset_groups', JSON.stringify(sellPresetGroups));
  }, [sellPresetGroups]);

  useEffect(() => {
    localStorage.setItem('pm_active_sell_preset_group_id', activeSellGroupId);
  }, [activeSellGroupId]);

  useEffect(() => {
    localStorage.setItem('pm_slippage', slippage);
  }, [slippage]);

  useEffect(() => {
    localStorage.setItem('pm_priority_fee', priorityFee);
  }, [priorityFee]);

  // Persist wallets list and activeWalletId
  useEffect(() => {
    walletsRef.current = wallets;
    localStorage.setItem('pm_wallets', JSON.stringify(wallets));
    if (!isStorageSyncingRef.current && !isSwitchingWalletRef.current) {
      chrome.storage?.local?.set({ pm_wallets: wallets }).catch(() => {});
    }
  }, [wallets]);

  useEffect(() => {
    activeWalletIdRef.current = activeWalletId;
    localStorage.setItem('pm_active_wallet_id', activeWalletId);
    if (!isStorageSyncingRef.current && !isSwitchingWalletRef.current) {
      chrome.storage?.local?.set({ pm_active_wallet_id: activeWalletId }).catch(() => {});
    }
  }, [activeWalletId]);

  // Keep the active wallet object updated with the current balance, starting balance, positions, and trades
  useEffect(() => {
    if (isStorageSyncingRef.current || isSwitchingWalletRef.current) return;
    setWallets((prev) => {
      const active = prev.find((w) => w.id === activeWalletId);
      if (!active) return prev;
      if (
        active.balance === balance &&
        active.startingBalance === startingBalance &&
        active.positions === positions &&
        active.tradeHistory === tradeHistory
      ) {
        return prev;
      }
      return prev.map((w) =>
        w.id === activeWalletId
          ? {
              ...w,
              balance,
              startingBalance,
              positions,
              tradeHistory,
            }
          : w
      );
    });
  }, [balance, startingBalance, positions, tradeHistory, activeWalletId]);

  // Helper to extract Solana address from URL
  const extractMintFromUrl = (url?: string): string | null => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      // On axiom.trade, the URL route is not the CA, so ignore URL parsing
      if (parsed.hostname.includes('axiom')) return null;

      // Path segments
      const parts = parsed.pathname.split('/').filter(Boolean);
      for (const p of parts) {
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p)) return p;
      }
      // Query parameters
      for (const [_k, val] of parsed.searchParams.entries()) {
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(val)) return val;
      }
      // Hash
      if (parsed.hash) {
        const hashParts = parsed.hash.split(/[\/?&=#]/).filter(Boolean);
        for (const p of hashParts) {
          if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p)) return p;
        }
      }
      // Generic match
      const matches = url.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g);
      if (matches && matches.length > 0) {
        return matches.find((m) => m.length >= 40) || matches[0];
      }
    } catch {}
    return null;
  };

  // 1. Initial & real-time detection from active tab only (guarded against background tab collisions)
  useEffect(() => {
    if (typeof chrome === 'undefined') return;

    const clearToken = () => {
      setMint('');
      setPairData(null);
      setScrapedData(null);
      setPrice(0);
      setLiveMarketCap(null);
      setLiveLiquidity(null);
      setLiveVolume(null);
      prevPriceRef.current = 0;
    };

    const applyScraped = (res: any) => {
      if (!res) return;
      if (res.mint && typeof res.mint === 'string') {
        if (res.mint !== mintRef.current) {
          setMint(res.mint);
        }
      }
      const raw = res.scrapedNumber || res.price;
      const computedPrice = raw && typeof raw === 'number' && raw > 0
        ? (raw >= 1000 ? raw / 1000 : raw) * 0.000001
        : 0;

      if (raw && typeof raw === 'number' && raw > 0) {
        setLiveMarketCap(raw);
        setPrice(computedPrice);

        // Record in positionPrices
        const targetMint = res.mint || mintRef.current;
        if (targetMint && computedPrice > 0) {
          positionPricesRef.current[targetMint] = computedPrice;
          setPositionPrices((prev) => ({ ...prev, [targetMint]: computedPrice }));
        }
      }
      if (res.scrapedLiquidity && typeof res.scrapedLiquidity === 'number' && res.scrapedLiquidity > 0) {
        setLiveLiquidity(res.scrapedLiquidity);
      }
      if (res.scrapedVolume && typeof res.scrapedVolume === 'number' && res.scrapedVolume > 0) {
        setLiveVolume(res.scrapedVolume);
      }
      if (res.scrapedImage && typeof res.scrapedImage === 'string') {
        setScrapedData((prev) => ({ ...prev, imageUrl: res.scrapedImage }));
      }
    };

    const checkTab = (tab?: chrome.tabs.Tab) => {
      if (!tab || tab.id === undefined) return;
      activeTabIdRef.current = tab.id;

      // 1. URL extraction (e.g. DexScreener, pump.fun)
      const found = extractMintFromUrl(tab.url);
      if (found) {
        if (found !== mintRef.current) {
          setMint(found);
          setPairData(null);
          setPrice(0);
        }
        chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_TOKEN' }, (res) => {
          if (chrome.runtime.lastError) return;
          if (activeTabIdRef.current !== tab.id) return;
          applyScraped(res);
        });
        return;
      }

      // 2. Direct query to content script (e.g. Axiom or SPA)
      chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_TOKEN' }, (res) => {
        if (chrome.runtime.lastError) {
          // Tab has no content script (chrome://, blank tab, or non-crypto page)
          if (activeTabIdRef.current === tab.id) {
            clearToken();
          }
          return;
        }

        if (activeTabIdRef.current !== tab.id) return;

        if (res?.mint && typeof res.mint === 'string') {
          if (res.mint !== mintRef.current) {
            setMint(res.mint);
            setPairData(null);
            setPrice(0);
          }
          applyScraped(res);
        } else {
          // Content script active, but no token on this page yet (might still be hydrating/rendering)
          const url = tab.url?.toLowerCase() || '';
          const isTradingSite = url.includes('axiom') || url.includes('pump.fun') || url.includes('dexscreener') || url.includes('photon') || url.includes('bullx') || url.includes('gmgn');
          if (isTradingSite) {
            setTimeout(() => {
              if (activeTabIdRef.current === tab.id && tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_TOKEN' }, (retryRes) => {
                  if (activeTabIdRef.current !== tab.id || chrome.runtime.lastError || !retryRes) return;
                  if (retryRes.mint) {
                    if (retryRes.mint !== mintRef.current) {
                      setMint(retryRes.mint);
                      setPairData(null);
                      setPrice(0);
                    }
                    applyScraped(retryRes);
                  }
                });
              }
            }, 400);

            setTimeout(() => {
              if (activeTabIdRef.current === tab.id && tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_TOKEN' }, (retryRes) => {
                  if (activeTabIdRef.current !== tab.id || chrome.runtime.lastError || !retryRes) return;
                  if (retryRes.mint) {
                    if (retryRes.mint !== mintRef.current) {
                      setMint(retryRes.mint);
                      setPairData(null);
                      setPrice(0);
                    }
                    applyScraped(retryRes);
                  }
                });
              }
            }, 1200);
          } else {
            clearToken();
          }
        }
      });
    };

    // Message handler: active tab drives terminal; background tabs update position prices if they match an open bag
    const handleMessage = (
      msg: {
        type: string;
        mint?: string;
        scrapedNumber?: number;
        scrapedLiquidity?: number;
        scrapedVolume?: number;
        scrapedImage?: string;
        price?: number;
        scraped?: any;
      },
      sender: chrome.runtime.MessageSender
    ) => {
      if (msg?.type !== 'PRICE_TICK' && msg?.type !== 'TOKEN_CHANGED') return;

      const raw = msg.scrapedNumber || msg.price;
      const computedPrice = raw && typeof raw === 'number' && raw > 0
        ? (raw >= 1000 ? raw / 1000 : raw) * 0.000001
        : 0;

      // Determine if message is coming from the current active tab
      let isSenderActive = false;
      if (sender?.tab) {
        if (activeTabIdRef.current !== null) {
          isSenderActive = sender.tab.id === activeTabIdRef.current;
        } else {
          isSenderActive = !!sender.tab.active;
        }
      } else {
        isSenderActive = false;
      }

      if (isSenderActive) {
        // Active tab drives the terminal and current view
        if (msg.mint && typeof msg.mint === 'string' && msg.mint !== mintRef.current) {
          setMint(msg.mint);
        }

        // Suppress split-second DOM re-render glitches (e.g. sub-$10 fee/impact flash when token mcap is normal)
        if (prevPriceRef.current >= 1000 && raw && typeof raw === 'number' && raw < 10) {
          return;
        }

        if (raw && typeof raw === 'number' && raw > 0 && raw !== prevPriceRef.current) {
          setLiveMarketCap(raw);
          setPrice(computedPrice);

          if (prevPriceRef.current > 0) {
            setPriceDirection(raw > prevPriceRef.current ? 'up' : 'down');
            setTimeout(() => setPriceDirection(null), 600);
          }
          prevPriceRef.current = raw;
        }

        if (msg.scrapedLiquidity && typeof msg.scrapedLiquidity === 'number' && msg.scrapedLiquidity > 0) {
          setLiveLiquidity((prev) => (prev === msg.scrapedLiquidity ? prev : msg.scrapedLiquidity!));
        }

        if (msg.scrapedVolume && typeof msg.scrapedVolume === 'number' && msg.scrapedVolume > 0) {
          setLiveVolume((prev) => (prev === msg.scrapedVolume ? prev : msg.scrapedVolume!));
        }

        if (msg.scrapedImage && typeof msg.scrapedImage === 'string') {
          setScrapedData((prev) => (prev?.imageUrl === msg.scrapedImage ? prev : { ...prev, imageUrl: msg.scrapedImage }));
        }

        // Also record this price in positionPrices if changed
        const targetMint = msg.mint || mintRef.current;
        if (targetMint && computedPrice > 0 && positionPricesRef.current[targetMint] !== computedPrice) {
          positionPricesRef.current[targetMint] = computedPrice;
          setPositionPrices((prev) => (prev[targetMint] === computedPrice ? prev : { ...prev, [targetMint]: computedPrice }));
        }
      } else {
        // Message is from a BACKGROUND tab: do NOT touch active terminal token/view!
        // Record in positionPrices only if value actually changed
        if (msg.mint && computedPrice > 0 && positionPricesRef.current[msg.mint] !== computedPrice) {
          positionPricesRef.current[msg.mint] = computedPrice;
          setPositionPrices((prev) => (prev[msg.mint!] === computedPrice ? prev : { ...prev, [msg.mint!]: computedPrice }));
        }
      }
    };

    chrome.runtime?.onMessage.addListener(handleMessage);

    const refreshActiveTab = () => {
      chrome.tabs?.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          checkTab(tabs[0]);
        } else {
          chrome.tabs?.query({ active: true, currentWindow: true }, (cTabs) => {
            if (cTabs && cTabs[0]) {
              checkTab(cTabs[0]);
            } else {
              chrome.tabs?.query({ active: true }, (anyActive) => {
                if (anyActive && anyActive[0]) checkTab(anyActive[0]);
              });
            }
          });
        }
      });
    };

    // Initial query
    refreshActiveTab();

    const handleTabUpdated = (_tabId: number, changeInfo: { url?: string; status?: string }, tab: chrome.tabs.Tab) => {
      if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
        checkTab(tab);
      }
    };

    const handleTabActivated = (activeInfo: { tabId: number }) => {
      activeTabIdRef.current = activeInfo.tabId;
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          refreshActiveTab();
          return;
        }
        checkTab(tab);
      });
    };

    const handleWindowFocus = (_windowId: number) => {
      refreshActiveTab();
    };

    chrome.tabs?.onUpdated.addListener(handleTabUpdated);
    chrome.tabs?.onActivated.addListener(handleTabActivated);
    if (chrome.windows?.onFocusChanged) {
      chrome.windows.onFocusChanged.addListener(handleWindowFocus);
    }

    return () => {
      chrome.runtime?.onMessage.removeListener(handleMessage);
      chrome.tabs?.onUpdated.removeListener(handleTabUpdated);
      chrome.tabs?.onActivated.removeListener(handleTabActivated);
      if (chrome.windows?.onFocusChanged) {
        chrome.windows.onFocusChanged.removeListener(handleWindowFocus);
      }
    };
  }, []);

  // 1b. Fetch and refresh live SOL/USD exchange rate
  useEffect(() => {
    let cancelled = false;
    const fetchSolPrice = async () => {
      try {
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112', {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.pairs && data.pairs.length > 0) {
            // Find pair against USDC or first valid USD price
            const solPair = data.pairs.find(
              (p: any) =>
                p.quoteToken?.address === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' ||
                p.quoteToken?.symbol === 'USDC' ||
                p.quoteToken?.symbol === 'USDT'
            ) || data.pairs[0];
            const pUsd = parseFloat(solPair?.priceUsd);
            if (pUsd && pUsd > 0 && !cancelled) {
              setSolPriceUsd(pUsd);
              try {
                localStorage.setItem('pm_sol_price', pUsd.toString());
                chrome.storage?.local?.set({ pm_sol_price: pUsd }).catch(() => {});
              } catch {}
            }
          }
        }
      } catch (e) {
        // Fallback or ignore network error
      }
    };

    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 60000); // refresh every 60s
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Background price sync for open positions: if an open bag is not currently open in a tab, fetch DexScreener periodically
  useEffect(() => {
    const openMints = Object.keys(positions);
    if (openMints.length === 0) return;

    let cancelled = false;

    const syncPositionPrices = async () => {
      // 1. Direct query to open crypto tabs for real-time prices
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        chrome.tabs.query({}, (tabs) => {
          if (cancelled || !tabs) return;
          for (const t of tabs) {
            if (t.id && t.id !== activeTabIdRef.current) {
              const url = t.url?.toLowerCase() || '';
              // Only query trading platform tabs to avoid connection errors and message congestion on non-crypto tabs
              if (url.includes('axiom') || url.includes('pump.fun') || url.includes('dexscreener') || url.includes('photon') || url.includes('bullx') || url.includes('gmgn')) {
                chrome.tabs.sendMessage(t.id, { type: 'GET_CURRENT_TOKEN' }, (res) => {
                  if (cancelled || chrome.runtime.lastError || !res) return;
                  if (res.mint && res.scrapedNumber && res.scrapedNumber > 0) {
                    const raw = res.scrapedNumber;
                    const computed = (raw >= 1000 ? raw / 1000 : raw) * 0.000001;
                    if (computed > 0 && positionPricesRef.current[res.mint] !== computed) {
                      positionPricesRef.current[res.mint] = computed;
                      setPositionPrices((prev) => (prev[res.mint] === computed ? prev : { ...prev, [res.mint]: computed }));
                    }
                  }
                });
              }
            }
          }
        });
      }

      // 2. Fallback DexScreener batch endpoint for positions not currently open in any browser tab (throttled to 5s)
      const now = Date.now();
      if (now - lastDexFetchRef.current > 5000) {
        lastDexFetchRef.current = now;
        const nonActiveMints = openMints.filter((m) => m !== mint || price <= 0);
        if (nonActiveMints.length > 0) {
          try {
            const url = `https://api.dexscreener.com/latest/dex/tokens/${nonActiveMints.slice(0, 30).join(',')}`;
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok && !cancelled) {
              const data = await res.json();
              if (data?.pairs && Array.isArray(data.pairs)) {
                const updates: Record<string, number> = {};
                for (const p of data.pairs) {
                  const base = p.baseToken?.address;
                  const pUsd = parseFloat(p.priceUsd);
                  if (base && pUsd && pUsd > 0 && !updates[base]) {
                    updates[base] = pUsd;
                  }
                }
                if (!cancelled && Object.keys(updates).length > 0) {
                  setPositionPrices((prev) => {
                    let changed = false;
                    const next = { ...prev };
                    for (const [k, v] of Object.entries(updates)) {
                      if (next[k] !== v) {
                        next[k] = v;
                        changed = true;
                      }
                      positionPricesRef.current[k] = v;
                    }
                    return changed ? next : prev;
                  });
                }
              }
            }
          } catch {}
        }
      }
    };

    // Run once on position changes, then refresh every 1.5 seconds in the background
    syncPositionPrices();
    const posInterval = setInterval(syncPositionPrices, 1500);

    return () => {
      cancelled = true;
      clearInterval(posInterval);
    };
  }, [positions, mint, price]);

  // 3. Ultra-fast live price and DexScreener info fetching
  useEffect(() => {
    if (!mint) return;

    let isCancelled = false;
    let resolvedPairAddress: string | null = null;
    let inFlight = false;

    // Show loading spinner only on initial load if we don't have pairData yet
    if (!pairData || pairData.baseToken.address !== mint) {
      setLoading(true);
    }

    const fetchFast = async () => {
      if (inFlight) return;
      inFlight = true;

      try {
        let bestPair: DexPair | null = null;

        // FAST PATH: If we already resolved the direct pair address, fetch it directly (fastest response)
        if (resolvedPairAddress) {
          try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${resolvedPairAddress}`, {
              cache: 'no-store',
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.pairs && data.pairs.length > 0) {
                bestPair = data.pairs[0];
              } else if (data?.pair) {
                bestPair = data.pair;
              }
            }
          } catch {}
        }

        // FULL PATH: If not resolved yet or direct failed, check token & search
        if (!bestPair) {
          try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
              cache: 'no-store',
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.pairs && data.pairs.length > 0) {
                // Pick pair with info.imageUrl if available, or first pair
                const withImg = data.pairs.find((p: DexPair) => p.info?.imageUrl);
                const chosen = withImg || data.pairs[0];
                if (chosen) {
                  if (withImg?.info?.imageUrl && !chosen.info?.imageUrl) {
                    chosen.info = { ...chosen.info, imageUrl: withImg.info.imageUrl };
                  }
                  bestPair = chosen;
                }
              }
            }
          } catch {}
        }

        if (!bestPair) {
          try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${mint}`, {
              cache: 'no-store',
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.pairs && data.pairs.length > 0) {
                bestPair = data.pairs[0];
              }
            }
          } catch {}
        }

        if (!bestPair) {
          try {
            const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${mint}`, {
              cache: 'no-store',
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.pairs && data.pairs.length > 0) {
                bestPair = data.pairs[0];
              } else if (data?.pair) {
                bestPair = data.pair;
              }
            }
          } catch {}
        }

        if (isCancelled) return;

        if (bestPair) {
          if (bestPair.pairAddress) {
            resolvedPairAddress = bestPair.pairAddress;
          }
          setPairData(bestPair);
          const newPrice = parseFloat(bestPair.priceUsd) || 0;
          if (newPrice > 0) {
            prevPriceRef.current = newPrice;
            setPrice(newPrice);
          }
        }
      } catch (err) {
        console.error('Initial metadata fetch error:', err);
      } finally {
        inFlight = false;
        if (!isCancelled) setLoading(false);
      }
    };

    // One-time fetch for token metadata (symbol, dexId, etc.) - NO background polling interval
    fetchFast();

    return () => {
      isCancelled = true;
    };
  }, [mint]);

  // Current token position
  const currentPosition = mint ? positions[mint] : null;

  // Realized + Unrealized portfolio metrics (held natively in SOL, tracking live USD dynamically)
  const portfolioStats = useMemo(() => {
    let openPositionsValueUsd = 0;
    let totalInvestedUsd = 0;

    Object.values(positions).forEach((pos) => {
      totalInvestedUsd += pos.investedUsd;
      // If it's the active terminal token use live price, otherwise use live background tab/DexScreener price, or entry price
      const effectivePosPrice = pos.mint === mint && price > 0
        ? price
        : (positionPrices[pos.mint] || pos.entryPrice);
      const currentVal = pos.tokens * effectivePosPrice;
      openPositionsValueUsd += currentVal;
    });

    const rate = solPriceUsd || 150;
    const openPositionsValueSol = openPositionsValueUsd / rate;
    const totalInvestedSol = totalInvestedUsd / rate;
    const openPositionsPnlUsd = openPositionsValueUsd - totalInvestedUsd;
    const openPositionsPnlSol = openPositionsPnlUsd / rate;
    const openPositionsPnlPct = totalInvestedUsd > 0 ? (openPositionsPnlUsd / totalInvestedUsd) * 100 : 0;

    const netWorthSol = balance + openPositionsValueSol;
    const netWorthUsd = netWorthSol * rate;

    return {
      netWorthSol,
      netWorthUsd,
      netWorth: netWorthUsd,
      openPositionsValue: openPositionsValueUsd,
      openPositionsValueSol,
      totalInvested: totalInvestedUsd,
      totalInvestedSol,
      openPositionsPnlUsd,
      openPositionsPnlSol,
      openPositionsPnlPct,
      count: Object.keys(positions).length,
    };
  }, [positions, balance, mint, price, positionPrices, solPriceUsd]);

  // Current token PnL
  const currentPnlUsd = useMemo(() => {
    if (!currentPosition || price <= 0) return 0;
    const currentVal = currentPosition.tokens * price;
    return currentVal - currentPosition.investedUsd;
  }, [currentPosition, price]);

  const currentPnlPct = useMemo(() => {
    if (!currentPosition || currentPosition.investedUsd <= 0 || price <= 0) return 0;
    return (currentPnlUsd / currentPosition.investedUsd) * 100;
  }, [currentPosition, currentPnlUsd, price]);

  const currentMultiplier = useMemo(() => {
    if (!currentPosition || currentPosition.entryPrice <= 0 || price <= 0) return 1;
    return price / currentPosition.entryPrice;
  }, [currentPosition, price]);

  // Grouped Fills by mint (like Axiom's token summary: Bought, Sold, Holding, PnL)
  const groupedTrades = useMemo(() => {
    const map = new Map<
      string,
      {
        mint: string;
        symbol: string;
        totalBoughtUsd: number;
        totalBoughtTokens: number;
        totalSoldUsd: number;
        totalSoldTokens: number;
        realizedPnl: number;
        lastTimestamp: number;
        trades: TradeLog[];
      }
    >();

    for (const t of tradeHistory) {
      if (!map.has(t.mint)) {
        map.set(t.mint, {
          mint: t.mint,
          symbol: t.symbol,
          totalBoughtUsd: 0,
          totalBoughtTokens: 0,
          totalSoldUsd: 0,
          totalSoldTokens: 0,
          realizedPnl: 0,
          lastTimestamp: t.timestamp,
          trades: [],
        });
      }
      const item = map.get(t.mint)!;
      item.trades.push(t);
      if (t.timestamp > item.lastTimestamp) {
        item.lastTimestamp = t.timestamp;
      }
      if (t.type === 'BUY') {
        item.totalBoughtUsd += t.amountUsd;
        item.totalBoughtTokens += t.tokens;
      } else {
        item.totalSoldUsd += t.amountUsd;
        item.totalSoldTokens += t.tokens;
        if (t.realizedPnl !== undefined) {
          item.realizedPnl += t.realizedPnl;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [tradeHistory]);

  // Degen Scorecard & Trading Analytics (Win Rate, Profit Factor, Best Win, Worst Rug, etc.)
  const analytics = useMemo(() => {
    const closedOrPnlSells = tradeHistory.filter((t) => t.type === 'SELL' && t.realizedPnl !== undefined);
    const winTrades = closedOrPnlSells.filter((t) => (t.realizedPnl || 0) > 0);
    const lossTrades = closedOrPnlSells.filter((t) => (t.realizedPnl || 0) < 0);
    const breakevenTrades = closedOrPnlSells.filter((t) => (t.realizedPnl || 0) === 0);

    const totalRealizedPnl = closedOrPnlSells.reduce((acc, t) => acc + (t.realizedPnl || 0), 0);
    const totalGains = winTrades.reduce((acc, t) => acc + (t.realizedPnl || 0), 0);
    const totalLosses = Math.abs(lossTrades.reduce((acc, t) => acc + (t.realizedPnl || 0), 0));

    const winRate = closedOrPnlSells.length > 0 ? (winTrades.length / closedOrPnlSells.length) * 100 : 0;
    const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? 99.9 : 0;

    let bestTrade: TradeLog | null = null;
    let worstTrade: TradeLog | null = null;

    closedOrPnlSells.forEach((t) => {
      const pnl = t.realizedPnl || 0;
      if (!bestTrade || pnl > ((bestTrade as TradeLog).realizedPnl || 0)) bestTrade = t;
      if (!worstTrade || pnl < ((worstTrade as TradeLog).realizedPnl || 0)) worstTrade = t;
    });

    const totalVolume = tradeHistory.reduce((acc, t) => acc + t.amountUsd, 0);
    const totalBuysCount = tradeHistory.filter((t) => t.type === 'BUY').length;
    const totalSellsCount = tradeHistory.filter((t) => t.type === 'SELL').length;

    // Net growth from starting balance (in SOL)
    const balancePnl = portfolioStats.netWorthSol - startingBalance;
    const balancePnlPct = startingBalance > 0 ? (balancePnl / startingBalance) * 100 : 0;

    return {
      totalRealizedPnl,
      totalGains,
      totalLosses,
      winRate,
      winTradesCount: winTrades.length,
      lossTradesCount: lossTrades.length,
      breakevenTradesCount: breakevenTrades.length,
      totalClosedCount: closedOrPnlSells.length,
      profitFactor,
      bestTrade: bestTrade as TradeLog | null,
      worstTrade: worstTrade as TradeLog | null,
      totalVolume,
      totalBuysCount,
      totalSellsCount,
      balancePnl,
      balancePnlPct,
    };
  }, [tradeHistory, portfolioStats.netWorthSol, startingBalance]);

  // Copy mint address to clipboard
  const copyMint = () => {
    if (!mint) return;
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open Wallet Share Card Modal
  const handleShareWalletStats = () => {
    const timestamps = tradeHistory.map((t) => t.timestamp);
    const firstTime = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const lastTime = timestamps.length > 0 ? Math.max(...timestamps) : 0;
    setShareModalData({
      type: 'WALLET',
      totalPnlUsd: analytics.balancePnl * (solPriceUsd || 150),
      totalPnlSol: analytics.balancePnl,
      totalPnlPct: analytics.balancePnlPct,
      netWorthSol: portfolioStats.netWorthSol,
      netWorthUsd: portfolioStats.netWorthUsd,
      startingBalance,
      winRate: analytics.winRate,
      winTradesCount: analytics.winTradesCount,
      lossTradesCount: analytics.lossTradesCount,
      profitFactor: analytics.profitFactor,
      totalRealizedPnl: analytics.totalRealizedPnl,
      totalVolume: analytics.totalVolume,
      totalBuysCount: analytics.totalBuysCount,
      totalSellsCount: analytics.totalSellsCount,
      openPositionsCount: Object.keys(positions).length,
      firstTradeTimestamp: firstTime,
      lastTradeTimestamp: lastTime,
      solPriceUsd: solPriceUsd || 150,
      walletName: activeWallet?.name || 'Main Wallet',
    });
  };

  // Toast feedback helper with pausable countdown timer
  const closeToast = () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    if (toastIntervalRef.current) clearInterval(toastIntervalRef.current);
    setToastNotification(null);
    setToastProgress(100);
    setIsToastHovered(false);
    isToastHoveredRef.current = false;
  };

  const flashToast = (
    msgOrPayload: string | { message?: string; tradeEvent?: TrackerTradeEvent; type?: 'success' | 'info' | 'warn' | 'error' },
    durationMs: number = 3600
  ) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    if (toastIntervalRef.current) clearInterval(toastIntervalRef.current);

    const id = Date.now();
    let message = '';
    let tradeEvent: TrackerTradeEvent | undefined;
    let type: 'success' | 'info' | 'warn' | 'error' | undefined;

    if (typeof msgOrPayload === 'string') {
      message = msgOrPayload;
      const lower = message.toLowerCase();
      if (lower.includes('error') || lower.includes('insufficient') || lower.includes('dropped') || lower.includes('failed') || lower.includes('exceeded')) {
        type = 'error';
      } else if (lower.includes('warn') || lower.includes('below')) {
        type = 'warn';
      } else {
        type = 'success';
      }
    } else if (msgOrPayload) {
      message = msgOrPayload.message || '';
      tradeEvent = msgOrPayload.tradeEvent;
      type = msgOrPayload.type || (tradeEvent ? (tradeEvent.type === 'BUY' ? 'success' : 'warn') : 'success');
    }

    const effectiveDuration = tradeEvent ? Math.max(durationMs, 5000) : durationMs;

    setToastNotification({ id, message, tradeEvent, duration: effectiveDuration, type });
    setToastProgress(100);
    setIsToastHovered(false);
    isToastHoveredRef.current = false;
    toastRemainingRef.current = effectiveDuration;
    toastStartTimeRef.current = Date.now();

    toastIntervalRef.current = setInterval(() => {
      if (isToastHoveredRef.current) return;
      const elapsed = Date.now() - toastStartTimeRef.current;
      const rem = Math.max(0, toastRemainingRef.current - elapsed);
      const pct = (rem / effectiveDuration) * 100;
      setToastProgress(pct);
      if (rem <= 0) {
        closeToast();
      }
    }, 25);
  };

  const handleToastMouseEnter = () => {
    isToastHoveredRef.current = true;
    setIsToastHovered(true);
    // calculate remaining time so far
    const elapsed = Date.now() - toastStartTimeRef.current;
    toastRemainingRef.current = Math.max(0, toastRemainingRef.current - elapsed);
  };

  const handleToastMouseLeave = () => {
    isToastHoveredRef.current = false;
    setIsToastHovered(false);
    toastStartTimeRef.current = Date.now();
  };

  // Realistic Price Impact & Market Fees Engine with Priority Fee / Bribe Simulation (Axiom style)
  const calculateExecution = (usdAmount: number, isBuy: boolean) => {
    // 1. Resolve Effective Liquidity Pool size
    const effectivePoolLiquidity = liveLiquidity || pairData?.liquidity?.usd || 30000;
    // In constant product AMM, quote reserve in pool is approx half the total pool liquidity
    const quoteReserve = Math.max(1000, effectivePoolLiquidity * 0.5);

    // 2. Price impact: dx / (x + dx) for constant product AMM
    const priceImpactRatio = usdAmount / (quoteReserve + usdAmount);
    const priceImpactPct = Math.min(priceImpactRatio * 100, 90);

    // 3. User configured slippage tolerance
    let slippagePct = 1.0;
    if (slippage === 'Auto') {
      slippagePct = Math.max(1.0, priceImpactPct * 1.2);
    } else {
      const parsed = parseFloat(slippage.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed > 0) slippagePct = parsed;
    }

    const exceedsSlippage = priceImpactPct > slippagePct;

    // 4. Execution pricing:
    const effectivePrice = isBuy
      ? price * (1 + (priceImpactRatio * 0.5))
      : price * (1 - (priceImpactRatio * 0.5));

    // 5. User Priority Fee (Bribe) in SOL -> USD (approx $150/SOL)
    const solFeeNum = parseFloat(priorityFee) || 0.005;
    const solUsdPrice = 150; // standard solana conversion
    const priorityFeeUsd = solFeeNum * solUsdPrice;

    // Platform DEX fee: 1.0% + Priority Fee (in USD)
    const platformFeeUsd = usdAmount * 0.01;
    const totalFeeUsd = platformFeeUsd + priorityFeeUsd;

    // 6. Network Contention & Transaction Drop Simulation:
    // If 5m volume is heavy (> $50K), competition for block space is high.
    const fiveMinVol = liveVolume || pairData?.volume?.m5 || 20000;
    let dropProbability = 0;
    let latencyMs = 100; // default turbo speed

    if (solFeeNum < 0.002) {
      // Very low priority fee: high chance of getting dropped under volume
      if (fiveMinVol > 50000) dropProbability = 0.65;
      else if (fiveMinVol > 20000) dropProbability = 0.40;
      else dropProbability = 0.15;
      latencyMs = 1200 + Math.random() * 800; // 1.2s - 2.0s delay
    } else if (solFeeNum < 0.008) {
      // Standard / Medium priority fee: mostly safe
      if (fiveMinVol > 100000) dropProbability = 0.20;
      else dropProbability = 0.04;
      latencyMs = 400 + Math.random() * 300; // 400ms - 700ms
    } else {
      // Turbo MEV priority fee (>= 0.008 SOL / ~$1.20+): 0% drop, instant fill
      dropProbability = 0;
      latencyMs = 50 + Math.random() * 50; // 50ms - 100ms
    }

    const isDropped = Math.random() < dropProbability;

    return {
      effectivePrice: Math.max(0.00000001, effectivePrice),
      priceImpactPct,
      slippagePct,
      exceedsSlippage,
      totalFeeUsd,
      solFeeNum,
      priorityFeeUsd,
      latencyMs,
      isDropped,
    };
  };

  // Trade Execution: BUY (amount in SOL)
  const executeBuy = async (solAmount: number) => {
    if (solAmount <= 0) return;
    if (price <= 0) {
      flashToast('Price unavailable');
      return;
    }
    if (isExecuting) return;

    const rate = solPriceUsd || 150;
    const usdAmount = solAmount * rate;
    const exec = calculateExecution(usdAmount, true);

    if (exec.exceedsSlippage) {
      flashToast(`Slippage exceeded (${exec.priceImpactPct.toFixed(1)}% impact > ${exec.slippagePct.toFixed(1)}% limit)`);
      return;
    }

    // Total deduction in SOL: the solAmount + transaction & priority fees in SOL
    const totalFeeSol = exec.totalFeeUsd / rate;
    const totalDeductionSol = solAmount + totalFeeSol;

    if (balance < totalDeductionSol) {
      flashToast(`Insufficient balance (need ${totalDeductionSol.toFixed(3)} SOL incl. fees)`);
      return;
    }

    setIsExecuting(true);
    // Simulate real network execution latency based on priority fee
    await new Promise((resolve) => setTimeout(resolve, exec.latencyMs));
    setIsExecuting(false);

    // If transaction got dropped by validator due to low priority fee bribe
    if (exec.isDropped) {
      // Exactly like real Solana: the order failed to land, but priority fee gas was burned natively in SOL
      setBalance((prev) => Math.max(0, prev - exec.solFeeNum));
      flashToast(`Tx dropped: Priority fee (${exec.solFeeNum} SOL) was outbid. Increase bribe to land in block.`);
      return;
    }

    const boughtTokens = usdAmount / exec.effectivePrice;
    const newBalance = Math.max(0, balance - totalDeductionSol);
    setBalance(newBalance);

    const prevPos = positions[mint];
    const prevTokens = prevPos ? prevPos.tokens : 0;
    const prevInvested = prevPos ? prevPos.investedUsd : 0;

    const newTokens = prevTokens + boughtTokens;
    const newInvested = prevInvested + usdAmount + exec.totalFeeUsd;
    const avgEntry = newInvested / newTokens;

    const updatedPosition: Position = {
      mint,
      symbol: pairData?.baseToken.symbol || 'TOKEN',
      name: pairData?.baseToken.name || 'Token',
      entryPrice: avgEntry,
      tokens: newTokens,
      investedUsd: newInvested,
      createdAt: prevPos ? prevPos.createdAt : Date.now(),
    };

    setPositions((prev) => ({
      ...prev,
      [mint]: updatedPosition,
    }));

    // Record trade log
    const trade: TradeLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      mint,
      symbol: pairData?.baseToken.symbol || 'TOKEN',
      type: 'BUY',
      amountUsd: usdAmount,
      tokens: boughtTokens,
      price,
      effectivePrice: exec.effectivePrice,
      feeUsd: exec.totalFeeUsd,
      priceImpactPct: exec.priceImpactPct,
    };
    setTradeHistory((prev) => [trade, ...prev.slice(0, 49)]);

    flashToast(`Bought ${formatTokens(boughtTokens)} ${pairData?.baseToken.symbol || ''} for ${solAmount} SOL (${(exec.totalFeeUsd / rate).toFixed(4)} SOL fee)`);
  };

  // Trade Execution: SELL by percentage for any bag (works on all tabs)
  const executeSellForBag = async (pos: Position, percent: number) => {
    if (!pos || pos.tokens <= 0) return;
    if (isExecuting) return;

    const pctFactor = Math.min(Math.max(percent, 1), 100) / 100;
    const tokensToSell = pos.tokens * pctFactor;

    // Use live price if this is current token and price > 0, or cached positionPrices, otherwise fetch DexScreener price or entryPrice
    let tokenPrice = pos.mint === mint && price > 0 ? price : (positionPrices[pos.mint] || 0);
    if (tokenPrice <= 0) {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${pos.mint}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const p = parseFloat(data?.pairs?.[0]?.priceUsd);
          if (p && p > 0) tokenPrice = p;
        }
      } catch {}
    }
    if (tokenPrice <= 0) {
      tokenPrice = pos.entryPrice > 0 ? pos.entryPrice : 0.000001;
    }

    const grossUsd = tokensToSell * tokenPrice;
    const exec = calculateExecution(grossUsd, false);

    if (exec.exceedsSlippage) {
      flashToast(`Slippage exceeded (${exec.priceImpactPct.toFixed(1)}% impact > ${exec.slippagePct.toFixed(1)}% limit)`);
      return;
    }

    setIsExecuting(true);
    await new Promise((resolve) => setTimeout(resolve, exec.latencyMs));
    setIsExecuting(false);

    if (exec.isDropped) {
      setBalance((prev) => Math.max(0, prev - exec.solFeeNum));
      flashToast(`Sell dropped: Priority fee (${exec.solFeeNum} SOL) was outbid. Increase bribe to land in block.`);
      return;
    }

    // Realistic USD received after impact and fees
    const actualUsdGross = tokensToSell * exec.effectivePrice;
    const netUsdReceived = Math.max(0, actualUsdGross - exec.totalFeeUsd);
    const rate = solPriceUsd || 150;
    const netSolReceived = netUsdReceived / rate;

    // Proportionate cost basis sold
    const costBasisSold = pos.investedUsd * pctFactor;
    const realizedPnl = netUsdReceived - costBasisSold;

    const remainingTokens = pos.tokens - tokensToSell;
    const remainingInvested = Math.max(0, pos.investedUsd - costBasisSold);

    setBalance((prev) => prev + netSolReceived);

    setPositions((prev) => {
      const copy = { ...prev };
      if (remainingTokens > 0.000001 && remainingInvested > 0.01) {
        copy[pos.mint] = {
          ...pos,
          tokens: remainingTokens,
          investedUsd: remainingInvested,
        };
      } else {
        delete copy[pos.mint];
      }
      return copy;
    });

    const trade: TradeLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      mint: pos.mint,
      symbol: pos.symbol,
      type: 'SELL',
      amountUsd: netUsdReceived,
      tokens: tokensToSell,
      price: tokenPrice,
      effectivePrice: exec.effectivePrice,
      feeUsd: exec.totalFeeUsd,
      priceImpactPct: exec.priceImpactPct,
      realizedPnl,
    };
    setTradeHistory((prev) => [trade, ...prev.slice(0, 49)]);

    const pnlPrefix = realizedPnl >= 0 ? `+$${realizedPnl.toFixed(2)}` : `-$${Math.abs(realizedPnl).toFixed(2)}`;
    flashToast(`Sold ${percent}% of ${pos.symbol} for ${netSolReceived.toFixed(3)} SOL (~$${netUsdReceived.toFixed(2)}) (${pnlPrefix})`);
  };

  const executeSell = async (percent: number) => {
    if (currentPosition) {
      await executeSellForBag(currentPosition, percent);
    }
  };

  // Sell Initial (sell invested dollar amount, let the rest ride free!)
  const executeSellInitialForBag = async (pos: Position) => {
    if (!pos || pos.investedUsd <= 0 || pos.tokens <= 0) return;

    let tokenPrice = pos.mint === mint && price > 0 ? price : (positionPrices[pos.mint] || 0);
    if (tokenPrice <= 0) {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${pos.mint}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const p = parseFloat(data?.pairs?.[0]?.priceUsd);
          if (p && p > 0) tokenPrice = p;
        }
      } catch {}
    }
    if (tokenPrice <= 0) {
      tokenPrice = pos.entryPrice > 0 ? pos.entryPrice : 0.000001;
    }

    const currentTotalVal = pos.tokens * tokenPrice;
    if (currentTotalVal < pos.investedUsd) {
      flashToast('Position is below initial investment');
      return;
    }

    const tokensToSell = pos.investedUsd / tokenPrice;
    const usdReceived = pos.investedUsd;
    const rate = solPriceUsd || 150;
    const solReceived = usdReceived / rate;
    const remainingTokens = Math.max(0, pos.tokens - tokensToSell);

    setBalance((prev) => prev + solReceived);

    setPositions((prev) => {
      const copy = { ...prev };
      if (remainingTokens > 0.00001) {
        copy[pos.mint] = {
          ...pos,
          tokens: remainingTokens,
          investedUsd: 0, // 100% "house money"
          entryPrice: 0,
        };
      } else {
        delete copy[pos.mint];
      }
      return copy;
    });

    const trade: TradeLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      mint: pos.mint,
      symbol: pos.symbol,
      type: 'SELL',
      amountUsd: usdReceived,
      tokens: tokensToSell,
      price: tokenPrice,
      realizedPnl: 0,
    };
    setTradeHistory((prev) => [trade, ...prev.slice(0, 49)]);

    flashToast(`Sold initial ${solReceived.toFixed(3)} SOL (~$${usdReceived.toFixed(2)}) of ${pos.symbol}! Remainder is pure house money.`);
  };

  const executeSellInitial = () => {
    if (currentPosition) {
      executeSellInitialForBag(currentPosition);
    }
  };

  // Reset or add test funds (in SOL)
  const addFunds = (solAmount: number) => {
    setBalance((prev) => prev + solAmount);
    flashToast(`Added +${solAmount} SOL virtual funds`);
  };

  const resetAll = () => {
    if (confirm(`Reset balance to ${startingBalance} SOL and clear all positions?`)) {
      setBalance(startingBalance);
      setPositions({});
      setTradeHistory([]);
      flashToast(`Terminal reset to ${startingBalance} SOL`);
    }
  };

  const handleApplyCustomBalance = (newSolAmount: number, resetPositions: boolean = false) => {
    if (isNaN(newSolAmount) || newSolAmount <= 0) {
      flashToast('Enter a valid positive amount');
      return;
    }
    setStartingBalance(newSolAmount);
    setBalance(newSolAmount);
    if (resetPositions) {
      setPositions({});
      setTradeHistory([]);
      flashToast(`Reset account with ${newSolAmount} SOL starting balance`);
    } else {
      flashToast(`Updated cash balance to ${newSolAmount} SOL`);
    }
    setShowBalanceModal(false);
  };

  // Wallet Manager Handlers
  const handleSwitchWallet = (targetWalletId: string, customWalletsList?: WalletAccount[]) => {
    const currentWallets = customWalletsList || walletsRef.current;
    const target = currentWallets.find((w) => w.id === targetWalletId);
    if (!target) return;

    // Prevent background sync or storage echoes from clobbering this switch
    isSwitchingWalletRef.current = true;

    // Save active wallet changes into the list before switching away
    const updatedWallets = currentWallets.map((w) => {
      if (w.id === activeWalletIdRef.current && w.id !== targetWalletId) {
        return {
          ...w,
          balance: balanceRef.current,
          startingBalance: startingBalanceRef.current,
          positions: positionsRef.current,
          tradeHistory: tradeHistoryRef.current,
        };
      }
      return w;
    });

    walletsRef.current = updatedWallets;
    activeWalletIdRef.current = target.id;
    balanceRef.current = target.balance;
    startingBalanceRef.current = target.startingBalance;
    positionsRef.current = target.positions || {};
    tradeHistoryRef.current = target.tradeHistory || [];

    setWallets(updatedWallets);
    setActiveWalletId(target.id);
    setBalance(target.balance);
    setStartingBalance(target.startingBalance);
    setPositions(target.positions || {});
    setTradeHistory(target.tradeHistory || []);

    // Synchronously write to localStorage
    localStorage.setItem('pm_active_wallet_id', target.id);
    localStorage.setItem('pm_wallets', JSON.stringify(updatedWallets));
    localStorage.setItem('pm_balance_sol', target.balance.toString());
    localStorage.setItem('pm_starting_balance_sol', target.startingBalance.toString());
    localStorage.setItem('pm_positions', JSON.stringify(target.positions || {}));
    localStorage.setItem('pm_trades', JSON.stringify(target.tradeHistory || []));

    // Persist to chrome.storage.local
    if (chrome.storage?.local) {
      chrome.storage.local.set({
        pm_active_wallet_id: target.id,
        pm_wallets: updatedWallets,
        pm_balance_sol: target.balance,
        pm_starting_balance_sol: target.startingBalance,
        pm_positions: target.positions || {},
        pm_trades: target.tradeHistory || [],
      }).catch(() => {});
    }

    setTimeout(() => {
      isSwitchingWalletRef.current = false;
    }, 200);

    flashToast(`Switched to "${target.name}"`);
  };

  const handleCreateWallet = (name: string, initialBalance: number) => {
    const newId = `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cleanBal = initialBalance > 0 ? initialBalance : 10;
    const newWallet: WalletAccount = {
      id: newId,
      name: name.trim() || `Wallet ${walletsRef.current.length + 1}`,
      address: generateSimulatedSolanaAddress(),
      balance: cleanBal,
      startingBalance: cleanBal,
      positions: {},
      tradeHistory: [],
      createdAt: Date.now(),
    };

    const nextWallets = [...walletsRef.current, newWallet];
    handleSwitchWallet(newId, nextWallets);
    flashToast(`Created wallet "${newWallet.name}"`);
  };

  const handleRenameWallet = (id: string, newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    const updated = walletsRef.current.map((w) => (w.id === id ? { ...w, name: clean } : w));
    walletsRef.current = updated;
    setWallets(updated);
    localStorage.setItem('pm_wallets', JSON.stringify(updated));
    chrome.storage?.local?.set({ pm_wallets: updated }).catch(() => {});
    flashToast(`Renamed wallet to "${clean}"`);
  };

  const handleDeleteWallet = (id: string) => {
    if (walletsRef.current.length <= 1) {
      flashToast('Cannot delete the only wallet');
      return;
    }
    const target = walletsRef.current.find((w) => w.id === id);
    const remaining = walletsRef.current.filter((w) => w.id !== id);

    if (id === activeWalletIdRef.current) {
      handleSwitchWallet(remaining[0].id, remaining);
    } else {
      walletsRef.current = remaining;
      setWallets(remaining);
      localStorage.setItem('pm_wallets', JSON.stringify(remaining));
      chrome.storage?.local?.set({ pm_wallets: remaining }).catch(() => {});
    }
    flashToast(`Deleted wallet "${target?.name || 'Wallet'}"`);
  };

  const handleExportWallet = (id: string) => {
    const target = walletsRef.current.find((w) => w.id === id);
    if (!target) return;

    try {
      const exportPayload = {
        version: '2.0.0',
        type: 'paper_meme_single_wallet',
        exportedAt: new Date().toISOString(),
        wallet: target,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `${target.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      flashToast(`Exported "${target.name}" backup`);
    } catch {
      flashToast('Failed to export wallet');
    }
  };

  const handleExportAllWallets = () => {
    try {
      const exportPayload = {
        version: '2.0.0',
        type: 'paper_meme_all_wallets',
        exportedAt: new Date().toISOString(),
        activeWalletId: activeWalletIdRef.current,
        wallets: walletsRef.current,
        buyPresetGroups: presetGroups,
        activeBuyGroupId: activeGroupId,
        sellPresetGroups,
        activeSellGroupId,
        slippage,
        priorityFee,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `paper_meme_all_wallets_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      flashToast(`Exported all ${walletsRef.current.length} wallets`);
    } catch {
      flashToast('Failed to export all wallets');
    }
  };

  const handleImportWalletFile = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        // Case 1: Full multi-wallet backup
        if (data.type === 'paper_meme_all_wallets' && Array.isArray(data.wallets) && data.wallets.length > 0) {
          const activeId = data.activeWalletId || data.wallets[0].id;
          handleSwitchWallet(activeId, data.wallets);

          if (Array.isArray(data.buyPresetGroups) && data.buyPresetGroups.length > 0) setPresetGroups(data.buyPresetGroups);
          if (data.activeBuyGroupId) setActiveGroupId(data.activeBuyGroupId);
          if (Array.isArray(data.sellPresetGroups) && data.sellPresetGroups.length > 0) setSellPresetGroups(data.sellPresetGroups);
          if (data.activeSellGroupId) setActiveSellGroupId(data.activeSellGroupId);
          if (data.slippage) setSlippage(data.slippage);
          if (data.priorityFee) setPriorityFee(data.priorityFee);

          flashToast(`Imported ${data.wallets.length} wallets`);
          setShowWalletManager(false);
          return;
        }

        // Case 2: Single wallet export (v2)
        if (data.type === 'paper_meme_single_wallet' && data.wallet && typeof data.wallet === 'object') {
          const w = data.wallet;
          const newId = `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const importedBal = typeof w.balance === 'number' ? w.balance : 10;
          const importedStartBal = typeof w.startingBalance === 'number' ? w.startingBalance : importedBal;
          const importedWallet: WalletAccount = {
            id: newId,
            name: `${w.name || 'Imported Wallet'} (Imported)`,
            address: w.address || generateSimulatedSolanaAddress(),
            balance: importedBal,
            startingBalance: importedStartBal,
            positions: w.positions && typeof w.positions === 'object' ? w.positions : {},
            tradeHistory: Array.isArray(w.tradeHistory) ? w.tradeHistory : [],
            createdAt: Date.now(),
          };

          const nextWallets = [...walletsRef.current, importedWallet];
          handleSwitchWallet(newId, nextWallets);
          flashToast(`Imported wallet "${importedWallet.name}"`);
          setShowWalletManager(false);
          return;
        }

        // Case 3: Legacy format backup (v1)
        if (typeof data.balanceSol === 'number' || typeof data.balance === 'number') {
          const importedBal = typeof data.balanceSol === 'number' ? data.balanceSol : data.balance;
          const importedStartBal = typeof data.startingBalanceSol === 'number' ? data.startingBalanceSol : (data.startingBalance || importedBal);
          const newId = `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const importedWallet: WalletAccount = {
            id: newId,
            name: `Imported Backup (${importedBal.toFixed(1)} SOL)`,
            address: generateSimulatedSolanaAddress(),
            balance: importedBal,
            startingBalance: importedStartBal,
            positions: data.positions && typeof data.positions === 'object' ? data.positions : {},
            tradeHistory: Array.isArray(data.tradeHistory) ? data.tradeHistory : [],
            createdAt: Date.now(),
          };

          const nextWallets = [...walletsRef.current, importedWallet];
          handleSwitchWallet(newId, nextWallets);

          if (Array.isArray(data.buyPresetGroups) && data.buyPresetGroups.length > 0) setPresetGroups(data.buyPresetGroups);
          if (data.activeBuyGroupId) setActiveGroupId(data.activeBuyGroupId);
          if (Array.isArray(data.sellPresetGroups) && data.sellPresetGroups.length > 0) setSellPresetGroups(data.sellPresetGroups);
          if (data.activeSellGroupId) setActiveSellGroupId(data.activeSellGroupId);
          if (data.slippage) setSlippage(data.slippage);
          if (data.priorityFee) setPriorityFee(data.priorityFee);

          flashToast(`Imported wallet: ${importedBal.toFixed(2)} SOL & ${Object.keys(data.positions || {}).length} positions`);
          setShowWalletManager(false);
          return;
        }

        flashToast('Invalid wallet backup format');
      } catch {
        flashToast('Failed to parse backup JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleSavePresetGroup = () => {
    const validAmounts = draftAmounts
      .map((a) => parseFloat(a))
      .filter((a) => !isNaN(a) && a > 0);

    if (validAmounts.length === 0) {
      flashToast('Add at least one valid amount');
      return;
    }

    const trimmedName = draftName.trim() || 'Presets';
    setPresetGroups((prev) =>
      prev.map((g) => (g.id === editingGroup.id ? { ...g, name: trimmedName, amounts: validAmounts } : g))
    );
    flashToast(`Saved "${trimmedName}" presets`);
    setShowPresetModal(false);
  };

  const handleCreatePresetGroup = () => {
    const newId = `preset_${Date.now()}`;
    const newName = `Custom ${presetGroups.length + 1}`;
    const newGroup: BuyPresetGroup = {
      id: newId,
      name: newName,
      amounts: [0.1, 0.25, 0.5, 1, 2],
    };
    setPresetGroups((prev) => [...prev, newGroup]);
    setEditingGroupId(newId);
    setActiveGroupId(newId);
    setDraftName(newName);
    setDraftAmounts(['0.1', '0.25', '0.5', '1', '2']);
    flashToast('Created new preset profile');
  };

  const handleDeletePresetGroup = (groupId: string) => {
    if (presetGroups.length <= 1) {
      flashToast('Must keep at least one preset profile');
      return;
    }
    const filtered = presetGroups.filter((g) => g.id !== groupId);
    setPresetGroups(filtered);
    if (activeGroupId === groupId) {
      setActiveGroupId(filtered[0].id);
    }
    setEditingGroupId(filtered[0].id);
    flashToast('Preset profile deleted');
  };

  const handleResetPresetsToDefault = () => {
    setPresetGroups(DEFAULT_PRESET_GROUPS);
    setActiveGroupId('standard');
    setEditingGroupId('standard');
    setDraftName('Standard');
    setDraftAmounts(['0.1', '0.25', '0.5', '1', '2']);
    flashToast('Presets restored to default');
  };

  const handleSaveSellPresetGroup = () => {
    const validPercentages = draftSellPercentages
      .map((p) => Math.min(100, Math.max(1, parseFloat(p))))
      .filter((p) => !isNaN(p) && p > 0);

    if (validPercentages.length === 0) {
      flashToast('Add at least one valid percentage');
      return;
    }

    const trimmedName = draftSellName.trim() || 'Presets';
    setSellPresetGroups((prev) =>
      prev.map((g) => (g.id === editingSellGroup.id ? { ...g, name: trimmedName, percentages: validPercentages } : g))
    );
    flashToast(`Saved "${trimmedName}" sell presets`);
    setShowSellPresetModal(false);
  };

  const handleCreateSellPresetGroup = () => {
    const newId = `sell_preset_${Date.now()}`;
    const newName = `Custom ${sellPresetGroups.length + 1}`;
    const newGroup: SellPresetGroup = {
      id: newId,
      name: newName,
      percentages: [20, 40, 60, 80, 100],
    };
    setSellPresetGroups((prev) => [...prev, newGroup]);
    setEditingSellGroupId(newId);
    setActiveSellGroupId(newId);
    setDraftSellName(newName);
    setDraftSellPercentages(['20', '40', '60', '80', '100']);
    flashToast('Created new sell preset profile');
  };

  const handleDeleteSellPresetGroup = (groupId: string) => {
    if (sellPresetGroups.length <= 1) {
      flashToast('Must keep at least one sell preset profile');
      return;
    }
    const filtered = sellPresetGroups.filter((g) => g.id !== groupId);
    setSellPresetGroups(filtered);
    if (activeSellGroupId === groupId) {
      setActiveSellGroupId(filtered[0].id);
    }
    setEditingSellGroupId(filtered[0].id);
    flashToast('Sell preset profile deleted');
  };

  const handleResetSellPresetsToDefault = () => {
    setSellPresetGroups(DEFAULT_SELL_PRESET_GROUPS);
    setActiveSellGroupId('standard');
    setEditingSellGroupId('standard');
    setDraftSellName('Standard');
    setDraftSellPercentages(['25', '50', '75', '100']);
    flashToast('Sell presets restored to default');
  };

  // Handle manual mint submit
  const handleManualSearch = (e: any) => {
    e.preventDefault();
    const clean = manualMintInput.trim();
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean)) {
      setMint(clean);
      setManualMintInput('');
      setShowSearch(false);
    } else {
      flashToast('Invalid Solana address');
    }
  };

  const symbol =
    pairData?.baseToken.symbol ||
    scrapedData?.symbol ||
    (mint ? `${mint.slice(0, 4)}...${mint.slice(-4)}` : '---');
  const tokenName = pairData?.baseToken.name || scrapedData?.name || (mint ? 'Detected Token' : '');
  const dexId = pairData?.dexId ? pairData.dexId.toUpperCase() : 'AXIOM';
  const priceChange24h = pairData?.priceChange?.h24;
  const priceChange5m = pairData?.priceChange?.m5;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      {/* 1. TOP AXIOM NAVIGATION BAR */}
      <header
        style={{
          padding: '8px 12px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg
            width="19"
            height="19"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ color: '#ffffff', flexShrink: 0, display: 'block' }}
          >
            <g clipPath="url(#clip0_axiom_logo)">
              <path d="M24.1384 17.3876H11.8623L18.0001 7.00012L24.1384 17.3876Z" fill="currentColor" />
              <path d="M31 29.0003L5 29.0003L9.96764 20.5933L26.0324 20.5933L31 29.0003Z" fill="currentColor" />
            </g>
            <defs>
              <clipPath id="clip0_axiom_logo">
                <rect width="26" height="22" fill="white" transform="translate(5 7)" />
              </clipPath>
            </defs>
          </svg>
          <span
            className="mono"
            style={{
              color: 'var(--accent-green)',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
            }}
          >
            PAPER
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Live Sync Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(0, 245, 155, 0.08)',
              border: '1px solid rgba(0, 245, 155, 0.2)',
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--accent-green)',
            }}
          >
            <span className="live-dot" />
            <span>{loading ? 'SYNCING...' : 'LIVE'}</span>
          </div>

          {/* Wallet Manager Toggle Button */}
          <button
            onClick={() => setShowWalletManager(!showWalletManager)}
            data-tooltip={`Active Wallet: ${activeWallet?.name || 'Wallet'}`}
            data-tooltip-sub={`${(activeWallet?.balance ?? balance).toFixed(2)} SOL - Click to manage wallets`}
            data-tooltip-pos="bottom"
            style={{
              background: showWalletManager ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: showWalletManager ? '1px solid rgba(0, 245, 155, 0.4)' : '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '3px 8px',
              color: showWalletManager ? 'var(--accent-green)' : 'var(--text-primary)',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {/* Wallet Icon */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--accent-green)' }}>
              <rect x="2" y="5" width="20" height="14" rx="3" />
              <line x1="2" y1="10" x2="22" y2="10" />
              <circle cx="17" cy="14" r="1.5" fill="currentColor" />
            </svg>
            {/* Solana Logo & Balance */}
            <img
              src="https://axiom-assets-v2.axiom-cdn.io/images/sol-fill.svg"
              alt="SOL"
              style={{ width: 11, height: 11, flexShrink: 0, display: 'block' }}
            />
            <span
              className="mono"
              style={{
                color: '#fff',
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '-0.2px',
                flexShrink: 0,
              }}
            >
              {(activeWallet?.balance ?? balance).toFixed(2)}
            </span>
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                marginLeft: 3,
                flexShrink: 0,
                transform: showWalletManager ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
                color: 'var(--text-secondary)',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Quick Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            data-tooltip="Search or Paste Mint"
            data-tooltip-sub="Search token symbol or paste Solana contract address"
            data-tooltip-pos="bottom"
            style={{
              background: showSearch ? 'var(--border-subtle)' : 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '4px 7px',
              color: 'var(--text-secondary)',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </div>
      </header>

      {/* SEARCH / MANUAL CA BAR (COLLAPSIBLE) */}
      {showSearch && (
        <form
          onSubmit={handleManualSearch}
          style={{
            padding: '8px 12px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 6,
          }}
        >
          <input
            type="text"
            placeholder="Paste Solana token mint address..."
            value={manualMintInput}
            onInput={(e: any) => setManualMintInput(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: '6px 10px',
              color: '#fff',
              fontSize: 11,
            }}
          />
          <button
            type="submit"
            style={{
              background: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 12px',
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            Load
          </button>
        </form>
      )}



      {/* 2. MINIMALISTIC PORTFOLIO & POSITIONS HEADER (ONLY ON TERMINAL TAB) */}
      {activeTab === 'TRADE' && (
        <div
          style={{
            padding: '10px 14px 8px 14px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Main Stats Row: Cash Available & Open Positions (Bought, Holding, PnL) */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            {/* Left: Cash Available */}
            <div
              onClick={() => {
                setCustomBalanceInput(startingBalance.toString());
                setShowBalanceModal(true);
              }}
              data-tooltip="Cash Available"
              data-tooltip-sub="Click to modify paper funds or manage starting balance"
              data-tooltip-pos="bottom"
              style={{
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>Cash Available</span>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </div>
              <div style={{ marginTop: 2 }}>
                <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <img
                    src="https://axiom-assets-v2.axiom-cdn.io/images/sol-fill.svg"
                    alt="SOL"
                    style={{ width: 13, height: 13, flexShrink: 0, display: 'block' }}
                  />
                  <span>{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</span>
                </div>
                <div className="mono" style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', marginTop: 1 }}>
                  ${(balance * (solPriceUsd || 150)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Right: Open Positions Total Bought, Holding & PnL */}
            <div
              onClick={togglePositionsPopup}
              data-tooltip="Open Positions"
              data-tooltip-sub={`View all ${portfolioStats.count} active trades and PnL breakdown`}
              data-tooltip-pos="bottom"
              style={{
                textAlign: 'right',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Positions ({portfolioStats.count})
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: portfolioStats.openPositionsPnlSol >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                    background: portfolioStats.openPositionsPnlSol >= 0 ? 'rgba(0, 245, 155, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    padding: '1px 4px',
                    borderRadius: 3,
                  }}
                >
                  {portfolioStats.openPositionsPnlSol >= 0 ? '+' : ''}
                  {portfolioStats.openPositionsPnlPct.toFixed(1)}%
                </span>
              </div>

              {/* Holding in SOL (with Solana logo) & PnL */}
              <div style={{ marginTop: 2 }}>
                <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  <img
                    src="https://axiom-assets-v2.axiom-cdn.io/images/sol-fill.svg"
                    alt="SOL"
                    style={{ width: 13, height: 13, flexShrink: 0, display: 'block' }}
                  />
                  <span>{portfolioStats.openPositionsValueSol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</span>
                </div>

                {/* Sub-line: Bought vs Total PnL in SOL */}
                <div className="mono" style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                  <span>Bought {portfolioStats.totalInvestedSol.toFixed(2)}</span>
                  <span style={{ color: 'var(--border-hover)' }}>·</span>
                  <span style={{ color: portfolioStats.openPositionsPnlSol >= 0 ? 'var(--accent-green)' : 'var(--accent-red)', fontWeight: 700 }}>
                    {portfolioStats.openPositionsPnlSol >= 0 ? '+' : ''}
                    {portfolioStats.openPositionsPnlSol.toFixed(3)} SOL
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Utility Row: Live SOL Price Pill & Minimal Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
            {/* Left: Solana Logo & Live Price Pill */}
            <div
              data-tooltip="Live Solana Price"
              data-tooltip-sub="SOL / USD real-time price feed"
              data-tooltip-pos="bottom"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4.5,
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 6,
                padding: '2px 7px',
                userSelect: 'none',
              }}
            >
              {/* Axiom Solana Icon */}
              <img
                src="https://axiom-assets-v2.axiom-cdn.io/images/sol-fill.svg"
                alt="SOL"
                style={{ width: 11, height: 11, flexShrink: 0, display: 'block' }}
              />
              <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.2px' }}>
                ${(solPriceUsd || 150).toFixed(2)}
              </span>
            </div>

            {/* Right: Minimal Actions (+5, +10, Settings, Reset) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {/* Quick Fund +5 SOL */}
              <button
                onClick={() => addFunds(5)}
                data-tooltip="Add +5 SOL Paper Funds"
                data-tooltip-sub="Instantly deposit paper Solana into current wallet"
                data-tooltip-pos="bottom"
                style={{
                  background: 'rgba(0, 245, 155, 0.07)',
                  border: '1px solid rgba(0, 245, 155, 0.2)',
                  borderRadius: 5,
                  padding: '2px 7px',
                  color: 'var(--accent-green)',
                  fontSize: 9.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 245, 155, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(0, 245, 155, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 245, 155, 0.07)';
                  e.currentTarget.style.borderColor = 'rgba(0, 245, 155, 0.2)';
                }}
              >
                +5 SOL
              </button>

              {/* Quick Fund +10 */}
              <button
                onClick={() => addFunds(10)}
                data-tooltip="Add +10 SOL Paper Funds"
                data-tooltip-sub="Instantly deposit paper Solana into current wallet"
                data-tooltip-pos="bottom"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 5,
                  padding: '2px 6px',
                  color: 'var(--text-secondary)',
                  fontSize: 9.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                +10
              </button>

              {/* Settings */}
              <button
                onClick={() => {
                  setCustomBalanceInput(startingBalance.toString());
                  setShowBalanceModal(true);
                }}
                data-tooltip="Capital & Wallet Settings"
                data-tooltip-sub="Configure starting balance and paper trading parameters"
                data-tooltip-pos="bottom"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 5,
                  padding: '3px 6px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>

              {/* Reset */}
              <button
                onClick={resetAll}
                data-tooltip="Reset Portfolio"
                data-tooltip-sub={`Reset all funds to ${startingBalance} SOL and clear all positions`}
                data-tooltip-pos="bottom"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 5,
                  padding: '3px 6px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                  e.currentTarget.style.color = 'var(--accent-red)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BALANCE / CAPITAL SETTINGS MODAL */}
      {showBalanceModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setShowBalanceModal(false)}
        >
          <div
            className="ax-card"
            style={{
              width: '100%',
              maxWidth: 320,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hover)',
              padding: 16,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e: any) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: '#fff' }}>
                <span style={{ fontSize: 11 }}>⚙</span>
                <span>STARTING BALANCE</span>
              </div>
              <button
                onClick={() => setShowBalanceModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 14 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
              Set your preferred starting capital or top-up your current available cash balance.
            </div>

            {/* Quick Presets (in SOL) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
              {['2', '5', '10', '50'].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setCustomBalanceInput(amt)}
                  className={`btn-preset ${customBalanceInput === amt ? 'active' : ''}`}
                >
                  {amt} SOL
                </button>
              ))}
            </div>

            {/* Numeric input in SOL */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 16,
              }}
            >
              <input
                type="number"
                step="0.5"
                value={customBalanceInput}
                onInput={(e: any) => setCustomBalanceInput(e.target.value)}
                placeholder="10"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>SOL</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--accent-cyan)', marginLeft: 8 }}>
                ≈ ${((parseFloat(customBalanceInput) || 0) * (solPriceUsd || 150)).toFixed(0)} USD
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => handleApplyCustomBalance(parseFloat(customBalanceInput) || 0, false)}
                className="btn-buy"
                style={{ width: '100%', fontSize: 12, padding: 9 }}
              >
                Set Cash to {parseFloat(customBalanceInput) || 0} SOL (~${((parseFloat(customBalanceInput) || 0) * (solPriceUsd || 150)).toFixed(0)})
              </button>

              <button
                onClick={() => {
                  if (confirm(`Reset all open bags and start fresh with ${parseFloat(customBalanceInput) || 0} SOL?`)) {
                    handleApplyCustomBalance(parseFloat(customBalanceInput) || 0, true);
                  }
                }}
                style={{
                  width: '100%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--accent-red-border)',
                  color: 'var(--accent-red)',
                  padding: '8px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ↺ Reset All & Start with {parseFloat(customBalanceInput) || 0} SOL
              </button>

              {/* Backup & Restore Wallet Section */}
              <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.4px' }}>
                  Wallet Backup & Restore
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => handleExportWallet(activeWalletId)}
                    style={{
                      flex: 1,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      padding: '8px 0',
                      color: 'var(--accent-cyan)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Export Wallet JSON
                  </button>
                  <label
                    style={{
                      flex: 1,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 6,
                      padding: '8px 0',
                      color: 'var(--accent-orange)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    Import Wallet JSON
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportWalletFile}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SOLANA PRIORITY FEE / BRIBE CONFIGURATION MODAL */}
      {showFeeModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setShowFeeModal(false)}
        >
          <div
            className="ax-card"
            style={{
              width: '100%',
              maxWidth: 320,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hover)',
              padding: 16,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              borderRadius: 8,
            }}
            onClick={(e: any) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: '#fff' }}>
                <span>PRIORITY FEE & MEV BRIBE</span>
              </div>
              <button
                onClick={() => setShowFeeModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
              Set your validator priority tip. Lower fees risk dropped transactions and execution delays during high volume blocks.
            </div>

            {/* Quick Fee Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
              {[
                { label: 'Eco', fee: '0.001', note: 'Slow / Risk' },
                { label: 'Fast', fee: '0.005', note: 'Normal' },
                { label: 'Turbo', fee: '0.01', note: 'Instant / MEV' },
              ].map((opt) => {
                const isActive = priorityFee === opt.fee;
                return (
                  <button
                    key={opt.fee}
                    onClick={() => {
                      setPriorityFee(opt.fee);
                      setCustomFeeInput('');
                    }}
                    style={{
                      background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-card)',
                      border: `1px solid ${isActive ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                      color: isActive ? 'var(--accent-cyan)' : 'var(--text-primary)',
                      borderRadius: 6,
                      padding: '8px 4px',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{opt.label}</div>
                    <div className="mono" style={{ fontSize: 10, marginTop: 2 }}>{opt.fee} SOL</div>
                    <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>{opt.note}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Priority Fee Input */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>
                Custom Priority Fee (SOL)
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  padding: '6px 10px',
                }}
              >
                <input
                  type="number"
                  step="0.001"
                  placeholder={priorityFee}
                  value={customFeeInput}
                  onChange={(e: any) => setCustomFeeInput(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>SOL</span>
              </div>
            </div>

            {/* Live Fee Status indicator */}
            <div
              style={{
                fontSize: 10,
                color: parseFloat(priorityFee) < 0.002 ? 'var(--accent-red)' : parseFloat(priorityFee) >= 0.008 ? 'var(--accent-cyan)' : 'var(--accent-green)',
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '6px 8px',
                borderRadius: 4,
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>●</span>
              <span>
                {parseFloat(priorityFee) < 0.002
                  ? 'High risk of dropped txs in >$20K vol blocks'
                  : parseFloat(priorityFee) >= 0.008
                  ? 'Turbo priority: 0% drop rate, frontruns queue'
                  : 'Reliable execution: standard validator queue'}
              </span>
            </div>

            {/* Save / Apply */}
            <button
              onClick={() => {
                const customVal = parseFloat(customFeeInput);
                if (!isNaN(customVal) && customVal > 0) {
                  setPriorityFee(customVal.toString());
                }
                setShowFeeModal(false);
              }}
              className="ax-btn ax-btn-primary"
              style={{ width: '100%', fontSize: 12, padding: 8 }}
            >
              Save Priority Fee
            </button>
          </div>
        </div>
      )}

      {/* BUY PRESET CONFIGURATION MODAL */}
      {showPresetModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setShowPresetModal(false)}
        >
          <div
            className="ax-card"
            style={{
              width: '100%',
              maxWidth: 340,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hover)',
              padding: 16,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e: any) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: '#fff' }}>
                <span style={{ fontSize: 11 }}>⚙</span>
                <span>BUY PRESETS CONFIG</span>
              </div>
              <button
                onClick={() => setShowPresetModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 14 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
              Customize quick-buy buttons or create multiple preset profiles just like on Axiom.trade.
            </div>

            {/* Profile Selector Pills */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 5 }}>
                Preset Profiles
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {presetGroups.map((g) => {
                  const isSelected = g.id === editingGroupId;
                  const isCurrentActive = g.id === activeGroupId;
                  return (
                    <button
                      key={g.id}
                      onClick={() => {
                        setEditingGroupId(g.id);
                        setActiveGroupId(g.id);
                      }}
                      style={{
                        background: isSelected ? 'var(--accent-green-bg)' : 'var(--bg-card)',
                        border: `1px solid ${isSelected ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                        color: isSelected ? 'var(--accent-green)' : 'var(--text-primary)',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {g.name} {isCurrentActive && '●'}
                    </button>
                  );
                })}
                <button
                  onClick={handleCreatePresetGroup}
                  style={{
                    background: 'transparent',
                    border: '1px dashed var(--accent-cyan)',
                    color: 'var(--accent-cyan)',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: 6,
                  }}
                >
                  + New
                </button>
              </div>
            </div>

            {/* Profile Name Field */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                Profile Name
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={draftName}
                  onInput={(e: any) => setDraftName(e.target.value)}
                  placeholder="e.g. Standard, Degen, Micro"
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />
                {presetGroups.length > 1 && (
                  <button
                    onClick={() => handleDeletePresetGroup(editingGroupId)}
                    data-tooltip="Delete Preset Profile"
                    data-tooltip-pos="top"
                    style={{
                      background: 'var(--accent-red-bg)',
                      border: '1px solid var(--accent-red-border)',
                      color: 'var(--accent-red)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Preset Amounts Editor */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Button Amounts (SOL)
                </span>
                {draftAmounts.length < 8 && (
                  <button
                    onClick={() => setDraftAmounts([...draftAmounts, '0.5'])}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-cyan)',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + Add Button
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {draftAmounts.map((amt, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 44 }}>Btn {idx + 1}:</span>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        padding: '4px 8px',
                      }}
                    >
                      <input
                        type="number"
                        step="0.05"
                        value={amt}
                        onInput={(e: any) => {
                          const next = [...draftAmounts];
                          next[idx] = e.target.value;
                          setDraftAmounts(next);
                        }}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, marginLeft: 4 }}>SOL</span>
                    </div>
                    {draftAmounts.length > 2 && (
                      <button
                        onClick={() => setDraftAmounts(draftAmounts.filter((_, i) => i !== idx))}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: 12,
                          padding: '0 4px',
                          cursor: 'pointer',
                        }}
                        data-tooltip="Remove Preset Amount"
                        data-tooltip-pos="top"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={handleSavePresetGroup}
                className="btn-buy"
                style={{ width: '100%', fontSize: 12, padding: 9 }}
              >
                ✓ Save & Apply Presets
              </button>

              <button
                onClick={handleResetPresetsToDefault}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  padding: '6px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                ↺ Restore Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELL PRESET CONFIGURATION MODAL */}
      {showSellPresetModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
          onClick={() => setShowSellPresetModal(false)}
        >
          <div
            className="ax-card"
            style={{
              width: '100%',
              maxWidth: 340,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-hover)',
              padding: 16,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e: any) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: '#fff' }}>
                <span style={{ fontSize: 11 }}>⚙</span>
                <span>SELL PRESETS CONFIG</span>
              </div>
              <button
                onClick={() => setShowSellPresetModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 14 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
              Customize quick-sell percentage buttons and profiles like on Axiom.trade.
            </div>

            {/* Profile Selector Pills */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 5 }}>
                Sell Profiles
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {sellPresetGroups.map((g) => {
                  const isSelected = g.id === editingSellGroupId;
                  const isCurrentActive = g.id === activeSellGroupId;
                  return (
                    <button
                      key={g.id}
                      onClick={() => {
                        setEditingSellGroupId(g.id);
                        setActiveSellGroupId(g.id);
                      }}
                      style={{
                        background: isSelected ? 'var(--accent-red-bg)' : 'var(--bg-card)',
                        border: `1px solid ${isSelected ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
                        color: isSelected ? 'var(--accent-red)' : 'var(--text-primary)',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {g.name} {isCurrentActive && '●'}
                    </button>
                  );
                })}
                <button
                  onClick={handleCreateSellPresetGroup}
                  style={{
                    background: 'transparent',
                    border: '1px dashed var(--accent-orange)',
                    color: 'var(--accent-orange)',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: 6,
                  }}
                >
                  + New
                </button>
              </div>
            </div>

            {/* Profile Name Field */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                Profile Name
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={draftSellName}
                  onInput={(e: any) => setDraftSellName(e.target.value)}
                  placeholder="e.g. Standard, Scalp, Moon"
                  style={{
                    flex: 1,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />
                {sellPresetGroups.length > 1 && (
                  <button
                    onClick={() => handleDeleteSellPresetGroup(editingSellGroupId)}
                    data-tooltip="Delete Sell Preset Profile"
                    data-tooltip-pos="top"
                    style={{
                      background: 'var(--accent-red-bg)',
                      border: '1px solid var(--accent-red-border)',
                      color: 'var(--accent-red)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Preset Percentages Editor */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Button Percentages (% OF BAG)
                </span>
                {draftSellPercentages.length < 8 && (
                  <button
                    onClick={() => setDraftSellPercentages([...draftSellPercentages, '50'])}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-orange)',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + Add Button
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {draftSellPercentages.map((pct, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 44 }}>Btn {idx + 1}:</span>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        padding: '4px 8px',
                      }}
                    >
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={pct}
                        onInput={(e: any) => {
                          const next = [...draftSellPercentages];
                          next[idx] = e.target.value;
                          setDraftSellPercentages(next);
                        }}
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      />
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>%</span>
                    </div>
                    {draftSellPercentages.length > 2 && (
                      <button
                        onClick={() => setDraftSellPercentages(draftSellPercentages.filter((_, i) => i !== idx))}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: 12,
                          padding: '0 4px',
                          cursor: 'pointer',
                        }}
                        data-tooltip="Remove Percentage Button"
                        data-tooltip-pos="top"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={handleSaveSellPresetGroup}
                className="btn-sell"
                style={{ width: '100%', fontSize: 12, padding: 9 }}
              >
                ✓ Save & Apply Sell Presets
              </button>

              <button
                onClick={handleResetSellPresetsToDefault}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  padding: '6px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                ↺ Restore Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* VIEW 1: TRADING TERMINAL */}
        {activeTab === 'TRADE' && (
          <>
            {/* 3. TOKEN IDENTITY & PRICE HERO (MINIMALISTIC) */}
            {mint ? (
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Row 1: Token Avatar, Symbol, Dex, Name & Mint Copy Action */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                {(() => {
                  const axiomCdnUrl = mint ? `https://axiomtrading-v2.axiom-cdn.io/${mint}.webp` : '';
                  const dexCdnUrl = mint ? `https://cdn.dexscreener.com/token-images/og/solana/${mint}` : '';
                  const resolvedImg = axiomCdnUrl || pairData?.info?.imageUrl || scrapedData?.imageUrl || dexCdnUrl;

                  if (resolvedImg) {
                    return (
                      <div
                        style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}
                        onMouseEnter={() => setIsHoveringImage(true)}
                        onMouseLeave={() => setIsHoveringImage(false)}
                      >
                        <img
                          key={resolvedImg}
                          src={resolvedImg}
                          alt={symbol}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            objectFit: 'cover',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            background: 'var(--bg-card)',
                            cursor: 'pointer',
                            display: 'block',
                          }}
                          onError={(e: any) => {
                            const target = e.target as HTMLImageElement;
                            const secondaryFallback = pairData?.info?.imageUrl || dexCdnUrl;
                            if (secondaryFallback && target.src !== secondaryFallback) {
                              target.src = secondaryFallback;
                            } else {
                              target.style.display = 'none';
                              const fallbackDiv = target.nextElementSibling as HTMLElement | null;
                              if (fallbackDiv) fallbackDiv.style.display = 'flex';
                            }
                          }}
                        />

                        {/* Axiom-Style Hover Preview Popup */}
                        {isHoveringImage && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 40,
                              left: 0,
                              zIndex: 99999,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-hover)',
                              borderRadius: 12,
                              padding: 6,
                              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                              pointerEvents: 'none',
                              animation: 'fadeIn 0.15s ease',
                            }}
                          >
                            <img
                              src={resolvedImg}
                              alt={symbol}
                              style={{
                                width: 200,
                                height: 200,
                                borderRadius: 8,
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                            <div
                              style={{
                                marginTop: 6,
                                textAlign: 'center',
                                fontSize: 11,
                                fontWeight: 800,
                                color: '#fff',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                letterSpacing: '0.4px',
                              }}
                            >
                              ${symbol}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 12,
                        color: 'var(--accent-cyan)',
                        flexShrink: 0,
                      }}
                    >
                      {symbol.slice(0, 2)}
                    </div>
                  );
                })()}

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
                      ${symbol}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {dexId}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      maxWidth: 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: 1,
                    }}
                  >
                    {tokenName || 'Solana Token'}
                  </div>
                </div>
              </div>

              {/* Mint Copy Pill & External Axiom Link */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={copyMint}
                  style={{
                    background: copied ? 'rgba(0, 245, 155, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${copied ? 'rgba(0, 245, 155, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: copied ? 'var(--accent-green)' : 'var(--text-secondary)',
                    padding: '3px 7px',
                    borderRadius: 5,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease',
                  }}
                  data-tooltip="Click to copy Contract Address"
                  data-tooltip-sub={mint}
                  data-tooltip-pos="top"
                >
                  <span className="mono">{mint.slice(0, 4)}...{mint.slice(-4)}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {copied ? (
                      <polyline points="20 6 9 17 4 12"></polyline>
                    ) : (
                      <>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </>
                    )}
                  </svg>
                </button>
                {mint && (
                  <a
                    href={`https://axiom.trade/meme/${mint}`}
                    target="_blank"
                    rel="noreferrer"
                    data-tooltip="Open on Axiom.trade"
                    data-tooltip-sub="View chart & live trade on Axiom"
                    data-tooltip-pos="top"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 5,
                      padding: '3px 6px',
                      color: 'var(--text-muted)',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* Row 2: Price & Live Percentage Badges */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 2 }}>
              <div
                className={`mono ${priceDirection === 'up' ? 'flash-up' : priceDirection === 'down' ? 'flash-down' : ''}`}
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: '-0.5px',
                  color: '#fff',
                  transition: 'color 0.2s',
                }}
              >
                {formatPrice(price)}
              </div>

              {/* 24h & 5m changes */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {priceChange24h !== undefined && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: priceChange24h >= 0 ? 'rgba(0, 245, 155, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: priceChange24h >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                    }}
                  >
                    {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(1)}% <span style={{ opacity: 0.7, fontSize: 8.5 }}>24h</span>
                  </span>
                )}
                {priceChange5m !== undefined && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: priceChange5m >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                    }}
                  >
                    {priceChange5m >= 0 ? '+' : ''}{priceChange5m.toFixed(1)}% (5m)
                  </span>
                )}
              </div>
            </div>

            {/* Row 3: Minimalist Metrics Strip (MCap, Liq, Volume) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                paddingTop: 8,
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>MCap</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginTop: 1 }}>
                  {formatCompact(liveMarketCap || pairData?.marketCap || pairData?.fdv)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Liquidity</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginTop: 1 }}>
                  {formatCompact(liveLiquidity || pairData?.liquidity?.usd)}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>5m Volume</div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginTop: 1 }}>
                  {formatCompact(liveVolume || pairData?.volume?.m5 || pairData?.volume?.h24)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="ax-card" style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-cyan)', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 10 }}>
              <span className="live-dot" style={{ background: 'var(--accent-cyan)' }} />
              AWAITING TOKEN
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff', marginBottom: 4 }}>No active token on this tab</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
              Open any coin on <strong>axiom.trade</strong> or <strong>dexscreener.com</strong>, or paste a Solana CA below.
            </div>
            <button
              onClick={() => setShowSearch(true)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--accent-green)',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Paste Contract Address
            </button>
          </div>
        )}

        {/* 4. ACTIVE POSITION BANNER - Minimal banner matching open positions style without buttons */}
        {mint && currentPosition && currentPosition.tokens > 0 && (() => {
          const bagValueSol = (currentPosition.tokens * price) / (solPriceUsd || 150);
          const pnlSol = currentPnlUsd / (solPriceUsd || 150);
          const isProfit = currentPnlUsd >= 0;

          return (
            <div
              style={{
                padding: '9px 12px',
                background: isProfit ? 'rgba(0, 245, 155, 0.04)' : 'rgba(255, 59, 105, 0.04)',
                border: `1px solid ${isProfit ? 'rgba(0, 245, 155, 0.28)' : 'rgba(255, 59, 105, 0.28)'}`,
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#fff' }}>${currentPosition.symbol}</span>
                  <span
                    style={{
                      fontSize: 8.5,
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: isProfit ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 59, 105, 0.15)',
                      color: isProfit ? 'var(--accent-green)' : 'var(--accent-red)',
                    }}
                  >
                    {currentMultiplier.toFixed(2)}x
                  </span>
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {formatTokens(currentPosition.tokens)} · Entry {formatPrice(currentPosition.entryPrice)}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 13, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3.5 }}>
                  <img
                    src="https://axiom-assets-v2.axiom-cdn.io/images/sol-fill.svg"
                    alt="SOL"
                    style={{ width: 11, height: 11 }}
                  />
                  <span>{bagValueSol.toFixed(3)}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 500, color: 'var(--text-muted)' }}>
                    (${ (currentPosition.tokens * price).toFixed(1) })
                  </span>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: isProfit ? 'var(--accent-green)' : 'var(--accent-red)',
                    marginTop: 1,
                  }}
                >
                  {isProfit ? '+' : ''}{pnlSol.toFixed(3)} SOL ({isProfit ? '+' : ''}{currentPnlPct.toFixed(1)}%)
                </div>
              </div>
            </div>
          );
        })()}

        {/* 5. AXIOM TRADING TERMINAL (STACKED BUY & SELL - MINIMALISTIC) */}
        {mint ? (
          <div
            style={{
              padding: '12px 14px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* --- TOP: BUY SECTION --- */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      background: 'rgba(0, 245, 155, 0.12)',
                      border: '1px solid rgba(0, 245, 155, 0.25)',
                      color: 'var(--accent-green)',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      letterSpacing: '0.3px',
                    }}
                  >
                    BUY
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>${symbol}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Avail:{' '}
                  <span className="mono" style={{ color: '#fff', fontWeight: 700 }}>
                    {balance.toFixed(2)} SOL
                  </span>
                </div>
              </div>

              {/* Buy Presets Profile Selector & Edit */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1px 0 2px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', maxWidth: 260 }}>
                  {presetGroups.map((g) => {
                    const isActive = g.id === activePresetGroup.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => setActiveGroupId(g.id)}
                        style={{
                          background: isActive ? 'rgba(0, 245, 155, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isActive ? 'rgba(0, 245, 155, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                          color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                  <button
                    onClick={handleCreatePresetGroup}
                    data-tooltip="Add new preset profile"
                    data-tooltip-pos="top"
                    style={{
                      background: 'transparent',
                      border: '1px dashed rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-muted)',
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 4,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => {
                    setEditingGroupId(activePresetGroup.id);
                    setShowPresetModal(true);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: 9.5,
                    cursor: 'pointer',
                    padding: '2px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    fontWeight: 600,
                  }}
                  data-tooltip="Configure preset buttons"
                  data-tooltip-sub="Customize quick buy amounts for this profile"
                  data-tooltip-pos="top"
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                  <span>Edit</span>
                </button>
              </div>

              {/* Dynamic Buy Preset Buttons Grid (JUST THE NUMBER - NO 'SOL' TEXT) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${activePresetGroup.amounts.length}, 1fr)`,
                  gap: 5,
                }}
              >
                {activePresetGroup.amounts.map((amt) => {
                  const amtUsd = amt * (solPriceUsd || 150);
                  const canBuy = price > 0 && !!mint && balance >= amt;
                  return (
                    <button
                      key={amt}
                      onClick={() => executeBuy(amt)}
                      disabled={!canBuy}
                      className="btn-preset mono"
                      style={{
                        padding: '6px 2px',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                      data-tooltip={`Buy ${amt} SOL`}
                      data-tooltip-sub={`~$${amtUsd.toFixed(1)} USD paper order`}
                      data-tooltip-pos="top"
                    >
                      {amt}
                    </button>
                  );
                })}
              </div>

              {/* Custom Buy Row */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    padding: '5px 8px',
                  }}
                >
                  <input
                    type="number"
                    step="0.05"
                    value={customAmount}
                    onInput={(e: any) => setCustomAmount(e.target.value)}
                    placeholder="0.5"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginRight: 6 }}>SOL</span>
                  <span className="mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    ≈ ${( (parseFloat(customAmount) || 0) * (solPriceUsd || 150) ).toFixed(1)}
                  </span>
                </div>

                <button
                  onClick={() => executeBuy(parseFloat(customAmount) || 0)}
                  disabled={price <= 0 || !mint || !(parseFloat(customAmount) > 0) || balance < (parseFloat(customAmount) || 0)}
                  className="btn-buy"
                  style={{
                    padding: '6px 14px',
                    fontSize: 11,
                    fontWeight: 800,
                    borderRadius: 6,
                    opacity: price <= 0 || !mint || !(parseFloat(customAmount) > 0) || balance < (parseFloat(customAmount) || 0) ? 0.35 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Buy
                </button>
              </div>
            </div>

            {/* DIVIDER */}
            <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.05)', margin: '1px 0' }} />

            {/* --- BOTTOM: SELL SECTION --- */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      background: 'rgba(255, 59, 105, 0.12)',
                      border: '1px solid rgba(255, 59, 105, 0.25)',
                      color: 'var(--accent-red)',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      letterSpacing: '0.3px',
                    }}
                  >
                    SELL
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>${symbol}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Holding:{' '}
                  <span className="mono" style={{ color: '#fff', fontWeight: 700 }}>
                    {currentPosition ? `${formatTokens(currentPosition.tokens)}` : '0'}
                  </span>
                </div>
              </div>

              {/* Sell Presets Profile Selector & Edit */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1px 0 2px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', maxWidth: 260 }}>
                  {sellPresetGroups.map((g) => {
                    const isActive = g.id === activeSellPresetGroup.id;
                    return (
                      <button
                        key={g.id}
                        onClick={() => setActiveSellGroupId(g.id)}
                        style={{
                          background: isActive ? 'rgba(255, 59, 105, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${isActive ? 'rgba(255, 59, 105, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                          color: isActive ? 'var(--accent-red)' : 'var(--text-secondary)',
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                  <button
                    onClick={handleCreateSellPresetGroup}
                    data-tooltip="Add new sell preset profile"
                    data-tooltip-pos="top"
                    style={{
                      background: 'transparent',
                      border: '1px dashed rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-muted)',
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 4,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => {
                    setEditingSellGroupId(activeSellPresetGroup.id);
                    setShowSellPresetModal(true);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: 9.5,
                    cursor: 'pointer',
                    padding: '2px 4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    fontWeight: 600,
                  }}
                  data-tooltip="Configure sell preset buttons"
                  data-tooltip-sub="Customize exit percentages for this profile"
                  data-tooltip-pos="top"
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                  <span>Edit</span>
                </button>
              </div>

              {/* Dynamic Sell Preset Buttons Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activeSellPresetGroup.percentages.length + 1}, 1fr)`, gap: 5 }}>
                {activeSellPresetGroup.percentages.map((pct) => {
                  const canSell = !!currentPosition && currentPosition.tokens > 0 && price > 0;
                  return (
                    <button
                      key={pct}
                      onClick={() => executeSell(pct)}
                      disabled={!canSell}
                      className="btn-preset-sell mono"
                      style={{
                        padding: '6px 2px',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                      data-tooltip={`Sell ${pct}% of ${symbol}`}
                      data-tooltip-sub="Market sell portion of position"
                      data-tooltip-pos="top"
                    >
                      {pct}%
                    </button>
                  );
                })}
                <button
                  onClick={executeSellInitial}
                  disabled={!currentPosition || currentPosition.tokens <= 0 || price <= 0}
                  data-tooltip="Sell Initial Investment"
                  data-tooltip-sub="Sell initial USD investment to keep remaining bag risk-free"
                  data-tooltip-pos="top"
                  style={{
                    background: 'rgba(255, 149, 0, 0.08)',
                    border: '1px solid rgba(255, 149, 0, 0.25)',
                    color: 'var(--accent-orange)',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '6px 2px',
                    opacity: !currentPosition || currentPosition.tokens <= 0 || price <= 0 ? 0.35 : 1,
                    cursor: !currentPosition || currentPosition.tokens <= 0 || price <= 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  Initial
                </button>
              </div>

              {/* Custom Sell Row */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    padding: '5px 8px',
                  }}
                >
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={sellPercent}
                    onInput={(e: any) => setSellPercent(Math.min(100, Math.max(1, parseInt(e.target.value) || 0)))}
                    placeholder="Custom %"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>% OF BAG</span>
                </div>

                <button
                  onClick={() => executeSell(sellPercent)}
                  disabled={!currentPosition || currentPosition.tokens <= 0 || price <= 0}
                  className="btn-sell"
                  style={{
                    padding: '6px 14px',
                    fontSize: 11,
                    fontWeight: 800,
                    borderRadius: 6,
                    opacity: !currentPosition || currentPosition.tokens <= 0 || price <= 0 ? 0.35 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Sell
                </button>
              </div>
            </div>

            {/* Degen Terminal Settings: Slippage & MEV */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 8,
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: 10,
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <span>Slippage:</span>
                {['0.5%', '1.0%', '3.0%', 'Auto'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSlippage(s);
                      setShowCustomSlippage(false);
                    }}
                    style={{
                      background: slippage === s && !showCustomSlippage ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      border: 'none',
                      color: slippage === s && !showCustomSlippage ? 'var(--accent-green)' : 'var(--text-secondary)',
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 5px',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}

                {/* Custom Slippage Button / Input */}
                {showCustomSlippage ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid var(--border-hover)', borderRadius: 4, padding: '1px 3px' }}>
                    <input
                      type="number"
                      autoFocus
                      value={customSlippageInput}
                      placeholder="5.0"
                      onChange={(e: any) => setCustomSlippageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseFloat(customSlippageInput);
                          if (!isNaN(val) && val > 0) {
                            setSlippage(`${val.toFixed(1)}%`);
                            setShowCustomSlippage(false);
                          }
                        } else if (e.key === 'Escape') {
                          setShowCustomSlippage(false);
                        }
                      }}
                      style={{
                        width: 32,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-green)',
                        fontSize: 10,
                        fontWeight: 700,
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>%</span>
                    <button
                      onClick={() => {
                        const val = parseFloat(customSlippageInput);
                        if (!isNaN(val) && val > 0) {
                          setSlippage(`${val.toFixed(1)}%`);
                        }
                        setShowCustomSlippage(false);
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-green)', fontSize: 10, cursor: 'pointer', padding: '0 2px' }}
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowCustomSlippage(true);
                      setCustomSlippageInput(slippage.replace('%', ''));
                    }}
                    style={{
                      background: !['0.5%', '1.0%', '3.0%', 'Auto'].includes(slippage) ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      border: '1px dashed rgba(255, 255, 255, 0.1)',
                      color: !['0.5%', '1.0%', '3.0%', 'Auto'].includes(slippage) ? 'var(--accent-green)' : 'var(--text-muted)',
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                    data-tooltip="Custom Slippage Tolerance"
                    data-tooltip-sub="Set custom percentage max price impact"
                    data-tooltip-pos="top"
                  >
                    {!['0.5%', '1.0%', '3.0%', 'Auto'].includes(slippage) ? slippage : 'Custom'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>1% DEX</span>
                <button
                  type="button"
                  onClick={() => setShowFeeModal(true)}
                  style={{
                    background: parseFloat(priorityFee) >= 0.008 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${parseFloat(priorityFee) >= 0.008 ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                    color: parseFloat(priorityFee) >= 0.008 ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    fontSize: 9.5,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  data-tooltip="Priority Fee & MEV"
                  data-tooltip-sub="Configure Solana Priority Fee / Jito MEV Bribe"
                  data-tooltip-pos="top"
                >
                  <span>Fee: {priorityFee}</span>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : null}





          </>
        )}

        {/* VIEW 2: FULL-PAGE WALLET TRACKER (KEPT MOUNTED TO RUN IN BACKGROUND ON ALL TABS) */}
        <div style={{ display: activeTab === 'TRACKER' ? 'contents' : 'none' }}>
          <TrackerView
            solPriceUsd={solPriceUsd}
            onSelectToken={(selectedMint) => {
              setMint(selectedMint);
              setActiveTab('TRADE');
              flashToast('Loaded token into Trade terminal');
            }}
            flashToast={flashToast}
            onNewEventNotification={() => {
              if (currentAppTabRef.current !== 'TRACKER') {
                setUnreadTrackerCount((prev) => prev + 1);
              }
            }}
          />
        </div>

        {/* VIEW 3: FULL-PAGE HISTORY (STATS & FILLS) */}
        {activeTab === 'HISTORY' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeIn 0.15s ease' }}>
            {/* 1. Session Performance Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  Session Performance
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontFamily: 'monospace',
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {analytics.totalClosedCount} closed
                </span>
              </div>
            </div>

            {/* Share Performance Card Banner Button */}
            <button
              onClick={handleShareWalletStats}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '9px 0',
                background: 'rgba(0, 245, 155, 0.08)',
                border: '1px solid rgba(0, 245, 155, 0.25)',
                borderRadius: 8,
                color: 'var(--accent-green)',
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e: any) => (e.currentTarget.style.background = 'rgba(0, 245, 155, 0.16)')}
              onMouseLeave={(e: any) => (e.currentTarget.style.background = 'rgba(0, 245, 155, 0.08)')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              <span>Share Portfolio Performance Card</span>
            </button>

            {/* Header Banner: Win Rate & Profit Factor */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '10px 8px',
                borderRadius: 8,
                border: '1px solid rgba(255, 255, 255, 0.05)',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Win Rate</div>
                <div
                  className="mono"
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: analytics.winRate >= 50 ? 'var(--accent-green)' : analytics.totalClosedCount === 0 ? '#fff' : 'var(--accent-red)',
                    marginTop: 2,
                  }}
                >
                  {analytics.totalClosedCount > 0 ? `${analytics.winRate.toFixed(0)}%` : '---'}
                </div>
                <div style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {analytics.winTradesCount}W / {analytics.totalClosedCount - analytics.winTradesCount}L
                </div>
              </div>

              <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.06)', borderRight: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Realized PnL</div>
                <div
                  className="mono"
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: analytics.totalRealizedPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                    marginTop: 2,
                  }}
                >
                  {analytics.totalRealizedPnl >= 0 ? '+' : ''}${analytics.totalRealizedPnl.toFixed(2)}
                </div>
                <div style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {analytics.totalRealizedPnl >= 0 ? '+' : ''}{(analytics.totalRealizedPnl / (solPriceUsd || 150)).toFixed(3)} SOL
                </div>
              </div>

              <div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Profit Factor</div>
                <div
                  className="mono"
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: analytics.profitFactor >= 1.5 ? 'var(--accent-green)' : analytics.profitFactor >= 1 ? '#8ba2ff' : 'var(--accent-red)',
                    marginTop: 2,
                  }}
                >
                  {analytics.totalLosses > 0 ? analytics.profitFactor.toFixed(2) : analytics.totalGains > 0 ? '∞' : '---'}
                </div>
                <div style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  Gains / Losses
                </div>
              </div>
            </div>

            {/* Account Growth & Volume Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Account Return</div>
                <div
                  className="mono"
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: analytics.balancePnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                    marginTop: 3,
                  }}
                >
                  {analytics.balancePnl >= 0 ? '+' : ''}{analytics.balancePnl.toFixed(3)} SOL ({analytics.balancePnlPct >= 0 ? '+' : ''}{analytics.balancePnlPct.toFixed(1)}%)
                </div>
                <div style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  ≈ {analytics.balancePnl >= 0 ? '+' : ''}${ (analytics.balancePnl * (solPriceUsd || 150)).toFixed(2) } USD
                </div>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Turnover</div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 3 }}>
                  ${analytics.totalVolume.toFixed(2)}
                </div>
                <div style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {analytics.totalBuysCount} buys · {analytics.totalSellsCount} sells
                </div>
              </div>
            </div>

            {/* Best Win & Worst Loss */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              <div style={{ background: 'rgba(0, 245, 155, 0.04)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0, 245, 155, 0.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--accent-green)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Best Win
                </div>
                {analytics.bestTrade && (analytics.bestTrade.realizedPnl || 0) > 0 ? (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: '#fff' }}>
                      ${analytics.bestTrade.symbol}
                    </div>
                    <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-green)', marginTop: 2 }}>
                      +${(analytics.bestTrade.realizedPnl || 0).toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>No wins yet</div>
                )}
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.04)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                <div style={{ fontSize: 9, color: 'var(--accent-red)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Worst Loss
                </div>
                {analytics.worstTrade && (analytics.worstTrade.realizedPnl || 0) < 0 ? (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: '#fff' }}>
                      ${analytics.worstTrade.symbol}
                    </div>
                    <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-red)', marginTop: 2 }}>
                      -${Math.abs(analytics.worstTrade.realizedPnl || 0).toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>No losses yet</div>
                )}
              </div>
            </div>

            {/* Win / Loss Ratio bar */}
            {analytics.totalClosedCount > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>Win / Loss Ratio</span>
                  <span className="mono">{analytics.winTradesCount} / {analytics.totalClosedCount}</span>
                </div>
                <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ width: `${analytics.winRate}%`, background: 'var(--accent-green)', transition: 'width 0.3s' }} />
                  <div style={{ width: `${100 - analytics.winRate}%`, background: 'var(--accent-red)', transition: 'width 0.3s' }} />
                </div>
              </div>
            )}

            {/* 2. Trade Fills Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 8,
                marginTop: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  Trade Fills
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontFamily: 'monospace',
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {groupedTrades.length} tokens
                </span>
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {tradeHistory.length} total orders
              </div>
            </div>

            {/* Fills List */}
            {groupedTrades.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '48px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 24 }}>📜</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>No trade history yet</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 240, lineHeight: 1.4 }}>
                  Your completed buy and sell orders will be recorded here with realized PnL.
                </div>
              </div>
            ) : (
              groupedTrades.map((item) => {
                const pos = positions[item.mint];
                const holdingTokens = pos?.tokens || 0;
                const isSelected = item.mint === mint;
                const effectivePrice = isSelected && price > 0
                  ? price
                  : (positionPrices[item.mint] || pos?.entryPrice || 0);
                const unrealizedPnl = holdingTokens > 0 && effectivePrice > 0
                  ? (holdingTokens * effectivePrice) - (pos?.investedUsd || 0)
                  : 0;
                const totalPnlUsd = item.realizedPnl + unrealizedPnl;
                const totalPnlSol = totalPnlUsd / (solPriceUsd || 150);
                const pnlColor = totalPnlUsd >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                const pnlSign = totalPnlUsd >= 0 ? '+' : '';

                return (
                  <div
                    key={item.mint}
                    onClick={() => {
                      setFillsModalMint(item.mint);
                      if (item.mint !== mint) {
                        setMint(item.mint);
                      }
                    }}
                    style={{
                      background: isSelected ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)'}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: '#fff' }}>
                          ${item.symbol}
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                          {item.trades.length} {item.trades.length === 1 ? 'fill' : 'fills'}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Bought: <span className="mono" style={{ fontWeight: 600, color: '#fff' }}>${item.totalBoughtUsd.toFixed(2)}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: pnlColor, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                        <span>{pnlSign}{totalPnlSol.toFixed(3)}</span>
                        <img
                          src="https://axiom-assets-v2.axiom-cdn.io/images/sol-fill.svg"
                          alt="SOL"
                          style={{ width: 10, height: 10 }}
                        />
                      </div>
                      <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 1 }}>
                        {pnlSign}${totalPnlUsd.toFixed(2)}
                        {item.totalBoughtUsd > 0 ? ` (${pnlSign}${((totalPnlUsd / item.totalBoughtUsd) * 100).toFixed(1)}%)` : ''}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>

      {/* 8. FIXED FLOATING BOTTOM DOCK: CAPSULE NAVIGATION TABS */}
      <nav
        aria-label="Bottom Navigation"
        style={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          padding: '6px 12px 10px 12px',
          background: 'rgba(10, 12, 18, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.07)',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 8,
            padding: 2,
            gap: 2,
            maxWidth: 500,
            margin: '0 auto',
          }}
        >
          {[
            { id: 'TRADE', label: 'Trade', tip: 'Trading Terminal', sub: 'Execute paper trades with real-time Solana DEX prices' },
            { id: 'TRACKER', label: 'Tracker', badge: unreadTrackerCount > 0 ? unreadTrackerCount : undefined, tip: 'Wallet Tracker', sub: 'Live on-chain transaction feed and copy-trading' },
            { id: 'HISTORY', label: 'History', badge: groupedTrades.length, tip: 'Trade History', sub: 'Past orders, execution stats & realized PnL' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'TRACKER') {
                    setUnreadTrackerCount(0);
                  }
                }}
                data-tooltip={tab.tip}
                data-tooltip-sub={tab.sub}
                data-tooltip-pos="top"
                style={{
                  flex: 1,
                  padding: '7px 0',
                  background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  fontWeight: isActive ? 800 : 600,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '1px 5px',
                      borderRadius: 10,
                      background: isActive ? 'rgba(0, 245, 155, 0.18)' : 'rgba(255, 255, 255, 0.05)',
                      color: isActive ? 'var(--accent-green)' : 'var(--text-muted)',
                      fontFamily: 'monospace',
                      lineHeight: 1.2,
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* 9. FLOATING BOTTOM-RIGHT OPEN POSITIONS CIRCLE BUTTON (ONLY ON TERMINAL TAB) */}
      {activeTab === 'TRADE' && (
        <button
          onClick={togglePositionsPopup}
          data-tooltip="Open Positions"
          data-tooltip-sub={`${Object.keys(positions).length} active trades - Click to expand`}
          data-tooltip-pos="left"
          style={{
            position: 'fixed',
            bottom: 65,
            right: 12,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: showPositionsPopup && !isPositionsPopupClosing
              ? 'linear-gradient(135deg, #00f59b, #00c278)'
              : 'linear-gradient(135deg, rgba(22, 28, 40, 0.96), rgba(12, 16, 24, 0.98))',
            border: showPositionsPopup && !isPositionsPopupClosing
              ? '1px solid #00f59b'
              : '1px solid rgba(0, 245, 155, 0.35)',
            color: showPositionsPopup && !isPositionsPopupClosing ? '#0a0d14' : 'var(--accent-green)',
            boxShadow: showPositionsPopup && !isPositionsPopupClosing
              ? '0 0 20px rgba(0, 245, 155, 0.5), 0 4px 14px rgba(0, 0, 0, 0.6)'
              : '0 4px 18px rgba(0, 0, 0, 0.6), 0 0 10px rgba(0, 245, 155, 0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 45,
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            transform: showPositionsPopup && !isPositionsPopupClosing ? 'scale(1.06)' : 'scale(1)',
          }}
          onMouseEnter={(e: any) => {
            if (!showPositionsPopup || isPositionsPopupClosing) {
              e.currentTarget.style.borderColor = 'rgba(0, 245, 155, 0.7)';
              e.currentTarget.style.transform = 'scale(1.08)';
            }
          }}
          onMouseLeave={(e: any) => {
            if (!showPositionsPopup || isPositionsPopupClosing) {
              e.currentTarget.style.borderColor = 'rgba(0, 245, 155, 0.35)';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>

          {/* Notification Badge with Position Count */}
          {Object.keys(positions).length > 0 && (
            <span
              className="mono"
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                padding: '0 4px',
                background: portfolioStats.openPositionsPnlSol >= 0 ? '#00f59b' : '#ef4444',
                color: portfolioStats.openPositionsPnlSol >= 0 ? '#0a0d14' : '#fff',
                fontSize: 9.5,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #0d1117',
                lineHeight: 1,
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
              }}
            >
              {Object.keys(positions).length}
            </span>
          )}
        </button>
      )}

      {/* 10. FLOATING OPEN POSITIONS POPUP */}
      {showPositionsPopup && activeTab === 'TRADE' && (
        <>
          <div
            onClick={closePositionsPopup}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 48,
              background: 'rgba(0, 0, 0, 0.35)',
              animation: `${isPositionsPopupClosing ? 'popupBackdropOut' : 'popupBackdropIn'} 0.18s ease forwards`,
            }}
          />

          <div
            style={{
              position: 'fixed',
              bottom: 118,
              left: 12,
              right: 12,
              maxHeight: 'min(440px, calc(100vh - 140px))',
              background: 'rgba(13, 16, 24, 0.98)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 12,
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 245, 155, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 49,
              transformOrigin: 'bottom right',
              animation: `${isPositionsPopupClosing ? 'popupOut 0.18s cubic-bezier(0.16, 1, 0.3, 1)' : 'popupIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'} forwards`,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  Open Positions
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: 'rgba(0, 245, 155, 0.15)',
                    color: 'var(--accent-green)',
                  }}
                >
                  {Object.keys(positions).length}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {Object.keys(positions).length > 0 && (
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: portfolioStats.openPositionsPnlSol >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                    }}
                  >
                    {portfolioStats.openPositionsPnlSol >= 0 ? '+' : ''}{portfolioStats.openPositionsPnlSol.toFixed(3)} SOL ({portfolioStats.openPositionsPnlSol >= 0 ? '+' : ''}{portfolioStats.openPositionsPnlPct.toFixed(1)}%)
                  </div>
                )}
                <button
                  onClick={closePositionsPopup}
                  data-tooltip="Close"
                  data-tooltip-pos="bottom"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e: any) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e: any) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content / Positions List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {Object.keys(positions).length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 22 }}>💼</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>No open positions</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', maxWidth: 200, lineHeight: 1.4 }}>
                    Buy any token in the terminal to track your bags here.
                  </div>
                </div>
              ) : (
                Object.values(positions).map((pos) => {
                  const isSelected = pos.mint === mint;
                  const posPrice = isSelected && price > 0
                    ? price
                    : (positionPrices[pos.mint] || pos.entryPrice);
                  const posValUsd = pos.tokens * posPrice;
                  const posValSol = posValUsd / (solPriceUsd || 150);
                  const posPnlUsd = posValUsd - pos.investedUsd;
                  const posPnlSol = posPnlUsd / (solPriceUsd || 150);
                  const posPnlPct = pos.investedUsd > 0 ? (posPnlUsd / pos.investedUsd) * 100 : 0;
                  const isProfit = posPnlUsd >= 0;

                  return (
                    <div
                      key={pos.mint}
                      style={{
                        padding: '8px 10px',
                        background: isSelected ? 'rgba(0, 245, 155, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isSelected ? 'rgba(0, 245, 155, 0.25)' : 'rgba(255, 255, 255, 0.06)'}`,
                        borderRadius: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {/* Token Header Row */}
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
                        onClick={() => {
                          if (pos.mint !== mint) setMint(pos.mint);
                          closePositionsPopup();
                        }}
                        data-tooltip="View in Trading Terminal"
                        data-tooltip-sub={`Load $${pos.symbol} chart and order controls`}
                        data-tooltip-pos="top"
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontWeight: 800, fontSize: 12, color: '#fff' }}>${pos.symbol}</span>
                            {isSelected && (
                              <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: 'rgba(0, 245, 155, 0.15)', color: 'var(--accent-green)', fontWeight: 700 }}>
                                Active
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                            {formatTokens(pos.tokens)} · Entry {formatPrice(pos.entryPrice)}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div className="mono" style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                            <img
                              src="https://axiom-assets-v2.axiom-cdn.io/images/sol-fill.svg"
                              alt="SOL"
                              style={{ width: 9, height: 9 }}
                            />
                            <span>{posValSol.toFixed(3)}</span>
                          </div>
                          <div
                            className="mono"
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: isProfit ? 'var(--accent-green)' : 'var(--accent-red)',
                              marginTop: 1,
                            }}
                          >
                            {isProfit ? '+' : ''}{posPnlSol.toFixed(3)} ({isProfit ? '+' : ''}{posPnlPct.toFixed(1)}%)
                          </div>
                        </div>
                      </div>

                      {/* Quick Sell Controls */}
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {[25, 50, 100].map((pct) => (
                          <button
                            key={pct}
                            onClick={(e) => {
                              e.stopPropagation();
                              executeSellForBag(pos, pct);
                            }}
                            className="btn-preset-sell mono"
                            style={{ flex: 1, padding: '4px 2px', fontSize: 9.5, fontWeight: 700 }}
                            data-tooltip={`Sell ${pct}% of ${pos.symbol}`}
                            data-tooltip-pos="top"
                          >
                            {pct}%
                          </button>
                        ))}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            executeSellInitialForBag(pos);
                          }}
                          disabled={pos.investedUsd <= 0}
                          style={{
                            background: 'rgba(255, 149, 0, 0.08)',
                            border: '1px solid rgba(255, 149, 0, 0.25)',
                            color: 'var(--accent-orange)',
                            borderRadius: 6,
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '4px 6px',
                            cursor: pos.investedUsd <= 0 ? 'not-allowed' : 'pointer',
                            opacity: pos.investedUsd <= 0 ? 0.35 : 1,
                            whiteSpace: 'nowrap',
                          }}
                          data-tooltip="Sell Initial Investment"
                          data-tooltip-sub="Realize invested capital and hold the remainder risk-free"
                          data-tooltip-pos="top"
                        >
                          Initial
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* 11. REDESIGNED FLOATING NOTIFICATION POPUP (MATCHES WALLET DESIGN LANGUAGE) */}
      {toastNotification && (() => {
        const ev = toastNotification.tradeEvent;
        const isTrade = Boolean(ev);
        const cardColor = ev ? (ev.walletColor || '#00F59B') : (
          toastNotification.type === 'error' ? 'var(--accent-red)' :
          toastNotification.type === 'warn' ? '#ffaa00' : 'var(--accent-green)'
        );

        // Computed fallback metrics for trade
        const displayMc = ev ? (
          (ev.marketCapUsd && ev.marketCapUsd > 0)
            ? ev.marketCapUsd
            : (ev.tokensTraded && ev.amountUsd && ev.tokensTraded > 0
                ? Math.round((ev.amountUsd / ev.tokensTraded) * 1e9)
                : (ev.priceUsd ? Math.round(ev.priceUsd * 1e9) : Math.round(Math.max(45000, ev.amountUsd * 85 + 35000))))
        ) : 0;

        const displayTokens = ev ? (ev.tokensTraded || Math.round((ev.amountSol || 1) / 0.0000015)) : 0;
        const displayRemaining = ev ? (
          ev.remainingTokens !== undefined
            ? ev.remainingTokens
            : (ev.type === 'BUY' ? displayTokens : Math.round(displayTokens * 0.4))
        ) : 0;
        const displayRemainingPct = ev ? (
          ev.remainingPct !== undefined
            ? ev.remainingPct
            : (ev.type === 'BUY' ? 100 : (displayRemaining === 0 ? 0 : 40))
        ) : 0;

        const displayProfitUsd = ev ? (
          ev.profitUsd !== undefined
            ? ev.profitUsd
            : (ev.profitSol !== undefined
                ? Number((ev.profitSol * (solPriceUsd || 180)).toFixed(2))
                : Number((ev.amountUsd * 0.48).toFixed(2)))
        ) : 0;

        const displayProfitPct = ev?.profitPct !== undefined ? ev.profitPct : 55.4;

        const axiomCdn = ev ? `https://axiomtrading-v2.axiom-cdn.io/${ev.mint}.webp` : '';
        const dexCdn = ev ? `https://cdn.dexscreener.com/token-images/og/solana/${ev.mint}` : '';

        return (
          <div
            onMouseEnter={handleToastMouseEnter}
            onMouseLeave={handleToastMouseLeave}
            style={{
              position: 'fixed',
              bottom: activeTab === 'TRADE' ? 120 : 62,
              right: 14,
              maxWidth: isTrade ? 360 : 340,
              minWidth: 260,
              zIndex: 9999,
              background: `radial-gradient(circle at 0% 0%, ${cardColor}18 0%, transparent 70%), linear-gradient(135deg, rgba(20, 27, 43, 0.96) 0%, rgba(12, 16, 25, 0.98) 100%)`,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
              borderRadius: 10,
              boxShadow: `0 14px 38px rgba(0, 0, 0, 0.7), 0 0 20px ${cardColor}18`,
              overflow: 'hidden',
              animation: 'slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: 'default',
              userSelect: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: isTrade ? 8 : 0,
            }}
          >
            {isTrade && ev ? (
              /* TRACKER WALLET TRADE NOTIFICATION */
              <div style={{ padding: '10px 12px 6px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* 1. Header: Wallet Info, Action Badge & Close Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: `${cardColor}28`,
                        border: `1.5px solid ${cardColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {ev.walletEmoji || '🐋'}
                    </div>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: '#fff',
                        maxWidth: 120,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ev.walletNickname}
                    </span>
                    <span
                      style={{
                        fontSize: 8.5,
                        fontWeight: 800,
                        padding: '1.5px 5px',
                        borderRadius: 4,
                        background: ev.type === 'BUY' ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 75, 75, 0.15)',
                        color: ev.type === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)',
                        border: `1px solid ${ev.type === 'BUY' ? 'rgba(0, 245, 155, 0.35)' : 'rgba(255, 75, 75, 0.35)'}`,
                        letterSpacing: '0.3px',
                      }}
                    >
                      {ev.type === 'BUY' ? '▲ BUY' : '▼ SELL'}
                    </span>
                    {ev.isTest && (
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 800,
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: 'rgba(255, 187, 0, 0.15)',
                          color: '#ffbb00',
                          border: '1px solid rgba(255, 187, 0, 0.4)',
                        }}
                      >
                        TEST
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Just now</span>
                    <button
                      onClick={closeToast}
                      aria-label="Dismiss"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e: any) => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={(e: any) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 2. Trade Details: Token avatar, symbol & SOL amount */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 7,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                        position: 'relative',
                      }}
                    >
                      <span style={{ position: 'absolute', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)' }}>
                        {ev.tokenSymbol.slice(0, 2).toUpperCase()}
                      </span>
                      <img
                        src={axiomCdn}
                        alt={ev.tokenSymbol}
                        onError={(e: any) => {
                          if (e.target.src !== dexCdn) {
                            e.target.src = dexCdn;
                          } else {
                            e.target.style.opacity = '0';
                          }
                        }}
                        style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        ${ev.tokenSymbol}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
                        {ev.tokenName}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: ev.type === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)',
                      }}
                    >
                      {ev.type === 'BUY' ? '+' : '-'}{ev.amountSol.toFixed(2)} SOL
                    </div>
                    <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                      ~${ev.amountUsd.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* 3. Trade Metrics Strip: Market Cap, PnL, Remaining */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 7px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 6,
                    fontSize: 9.5,
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{ev.type === 'BUY' ? 'Buy MC:' : 'Sell MC:'}</span>
                    <span className="mono" style={{ color: '#fff', fontWeight: 700 }}>
                      {formatMarketCap(displayMc)}
                    </span>
                  </div>

                  {ev.type === 'SELL' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ color: 'var(--text-muted)' }}>PnL:</span>
                      <span className="mono" style={{ fontWeight: 800, color: displayProfitUsd >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {displayProfitUsd >= 0 ? '+' : ''}${Math.abs(displayProfitUsd).toFixed(0)} ({displayProfitPct >= 0 ? '+' : ''}{displayProfitPct.toFixed(0)}%)
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{ev.type === 'SELL' ? 'Remaining:' : 'Holding:'}</span>
                    <span className="mono" style={{ color: displayRemaining === 0 ? 'var(--accent-red)' : '#fff', fontWeight: 700 }}>
                      {displayRemaining === 0
                        ? '0 (Sold 100%)'
                        : `${formatTokenAmount(displayRemaining)}${ev.type === 'SELL' && displayRemainingPct > 0 ? ` (${displayRemainingPct.toFixed(0)}%)` : ''}`}
                    </span>
                  </div>
                </div>

                {/* 4. Action Row: 1-Click Ape & View in Tracker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 2 }}>
                  <button
                    onClick={() => {
                      setMint(ev.mint);
                      setActiveTab('TRADE');
                      closeToast();
                      flashToast(`Loaded $${ev.tokenSymbol} into terminal`);
                    }}
                    style={{
                      flex: 1,
                      padding: '5px 10px',
                      background: 'linear-gradient(135deg, rgba(0, 245, 155, 0.22) 0%, rgba(0, 212, 255, 0.16) 100%)',
                      border: '1px solid rgba(0, 245, 155, 0.4)',
                      borderRadius: 6,
                      color: '#00f59b',
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e: any) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 245, 155, 0.35) 0%, rgba(0, 212, 255, 0.25) 100%)';
                      e.currentTarget.style.borderColor = '#00f59b';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e: any) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 245, 155, 0.22) 0%, rgba(0, 212, 255, 0.16) 100%)';
                      e.currentTarget.style.borderColor = 'rgba(0, 245, 155, 0.4)';
                      e.currentTarget.style.color = '#00f59b';
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span>1-Click Ape ${ev.tokenSymbol}</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('TRACKER');
                      closeToast();
                    }}
                    style={{
                      padding: '5px 8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.09)',
                      borderRadius: 6,
                      color: 'var(--text-secondary)',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e: any) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e: any) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    Feed
                  </button>
                </div>
              </div>
            ) : (
              /* STANDARD NOTIFICATION */
              <div
                style={{
                  padding: '9px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: `${cardColor}25`,
                      border: `1px solid ${cardColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {toastNotification.type === 'error' ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={cardColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    ) : (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={cardColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fff',
                      letterSpacing: '0.2px',
                      lineHeight: 1.35,
                      wordBreak: 'break-word',
                    }}
                  >
                    {toastNotification.message}
                  </span>
                </div>

                <button
                  onClick={closeToast}
                  aria-label="Dismiss"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e: any) => (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={(e: any) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            {/* Running Timer Bar (Line) - Pauses when hovered */}
            <div
              style={{
                width: '100%',
                height: 2.5,
                background: 'rgba(255, 255, 255, 0.05)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${toastProgress}%`,
                  background: isToastHovered
                    ? 'var(--accent-blue)'
                    : `linear-gradient(90deg, ${cardColor}, #00d4ff)`,
                  transition: isToastHovered ? 'none' : 'width 0.03s linear, background 0.15s ease',
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* FLOATING FILLS MODAL */}
      {fillsModalMint && (() => {
        const modalItem = groupedTrades.find((g) => g.mint === fillsModalMint);
        if (!modalItem) return null;

        const modalPos = positions[modalItem.mint];
        const modalHoldingTokens = modalPos?.tokens || 0;
        const isModalSelected = modalItem.mint === mint;
        const modalUnrealizedPnl = modalHoldingTokens > 0 && isModalSelected && price > 0
          ? (modalHoldingTokens * price) - (modalPos?.investedUsd || 0)
          : 0;
        const modalTotalPnl = modalItem.realizedPnl + modalUnrealizedPnl;
        const modalPnlColor = modalTotalPnl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        const modalPnlSign = modalTotalPnl >= 0 ? '+' : '';

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: 16,
            }}
            onClick={() => setFillsModalMint(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 350,
                background: 'linear-gradient(180deg, #131722 0%, #0c0e15 100%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.04)',
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                animation: 'fadeIn 0.15s ease',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header: Padre.gg Token Hero & Top-Right Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <img
                    src={`https://axiomtrading-v2.axiom-cdn.io/${modalItem.mint}.webp`}
                    alt={modalItem.symbol}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      objectFit: 'cover',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.03)',
                      flexShrink: 0,
                    }}
                    onError={(e: any) => {
                      const target = e.target as HTMLImageElement;
                      const cdnFallback = `https://cdn.dexscreener.com/token-images/og/solana/${modalItem.mint}`;
                      if (target.src !== cdnFallback) target.src = cdnFallback;
                      else target.style.display = 'none';
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
                        ${modalItem.symbol}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--text-secondary)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {modalItem.mint.slice(0, 4)}...{modalItem.mint.slice(-4)}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                      Trade Fill Analytics
                    </div>
                  </div>
                </div>

                {/* Top-Right Action Controls: Share Stats + Close */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => {
                      const buyTrades = modalItem.trades.filter((t) => t.type === 'BUY');
                      const sellTrades = modalItem.trades.filter((t) => t.type === 'SELL');
                      const firstBuyTime = buyTrades.length > 0
                        ? Math.min(...buyTrades.map((t) => t.timestamp))
                        : modalItem.trades.length > 0
                        ? Math.max(...modalItem.trades.map((t) => t.timestamp))
                        : 0;
                      const lastSellTime = sellTrades.length > 0
                        ? Math.max(...sellTrades.map((t) => t.timestamp))
                        : modalItem.trades.length > 0
                        ? Math.max(...modalItem.trades.map((t) => t.timestamp))
                        : 0;

                      setShareModalData({
                        mint: modalItem.mint,
                        symbol: modalItem.symbol,
                        totalBoughtUsd: modalItem.totalBoughtUsd,
                        totalBoughtTokens: modalItem.totalBoughtTokens,
                        totalSoldUsd: modalItem.totalSoldUsd,
                        totalSoldTokens: modalItem.totalSoldTokens,
                        realizedPnl: modalItem.realizedPnl,
                        totalPnl: modalTotalPnl,
                        holdingTokens: modalHoldingTokens,
                        holdingUsd: modalPos ? modalPos.investedUsd : 0,
                        solPriceUsd: solPriceUsd || 150,
                        firstBuyTimestamp: firstBuyTime,
                        lastSellTimestamp: lastSellTime,
                      });
                    }}
                    data-tooltip="Share Stats Card"
                    data-tooltip-sub="Generate sleek shareable PnL card"
                    data-tooltip-pos="bottom"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 10px',
                      background: 'rgba(0, 245, 155, 0.12)',
                      border: '1px solid rgba(0, 245, 155, 0.3)',
                      borderRadius: 7,
                      color: 'var(--accent-green)',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e: any) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 155, 0.2)';
                    }}
                    onMouseLeave={(e: any) => {
                      e.currentTarget.style.background = 'rgba(0, 245, 155, 0.12)';
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    <span>Share</span>
                  </button>

                  <button
                    onClick={() => setFillsModalMint(null)}
                    data-tooltip="Close Modal"
                    data-tooltip-pos="bottom"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 26,
                      height: 26,
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 7,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e: any) => {
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e: any) => {
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Summary Metric Ribbon: Padre / Pumpfun Glow Card */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  background: 'rgba(0, 0, 0, 0.45)',
                  borderRadius: 10,
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '10px 4px',
                  textAlign: 'center',
                }}
              >
                {/* Bought */}
                <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.06)', padding: '0 4px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>Bought</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 12, color: 'var(--accent-green)', marginTop: 2 }}>
                    ${modalItem.totalBoughtUsd.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>
                    {formatTokens(modalItem.totalBoughtTokens)}
                  </div>
                </div>

                {/* Sold */}
                <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.06)', padding: '0 4px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>Sold</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 12, color: 'var(--accent-red)', marginTop: 2 }}>
                    ${modalItem.totalSoldUsd.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>
                    {formatTokens(modalItem.totalSoldTokens)}
                  </div>
                </div>

                {/* Holding */}
                <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.06)', padding: '0 4px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>Holding</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 12, color: modalHoldingTokens > 0 ? '#fff' : 'var(--text-muted)', marginTop: 2 }}>
                    {formatTokens(modalHoldingTokens)}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>
                    {modalPos ? `$${modalPos.investedUsd.toFixed(1)}` : '$0'}
                  </div>
                </div>

                {/* PnL */}
                <div style={{ padding: '0 4px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>PnL</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 12, color: modalPnlColor, marginTop: 2 }}>
                    {modalPnlSign}${modalTotalPnl.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 8, color: modalPnlColor, marginTop: 1, fontWeight: 700 }}>
                    {modalItem.totalBoughtUsd > 0
                      ? `${modalPnlSign}${((modalTotalPnl / modalItem.totalBoughtUsd) * 100).toFixed(1)}%`
                      : '0%'}
                  </div>
                </div>
              </div>

              {/* List of Individual Fills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                  <span>Order Book History</span>
                  <span style={{ fontFamily: 'monospace' }}>{modalItem.trades.length} fills</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto', paddingRight: 2 }}>
                  {modalItem.trades.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11,
                        padding: '7px 10px',
                        background: t.type === 'BUY' ? 'rgba(0, 245, 155, 0.03)' : 'rgba(255, 75, 75, 0.03)',
                        border: `1px solid ${t.type === 'BUY' ? 'rgba(0, 245, 155, 0.12)' : 'rgba(255, 75, 75, 0.12)'}`,
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: t.type === 'BUY' ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 75, 75, 0.15)',
                            color: t.type === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)',
                            letterSpacing: '0.3px',
                          }}
                        >
                          {t.type}
                        </span>
                        <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
                          {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="mono" style={{ fontWeight: 800, color: '#fff', fontSize: 11 }}>
                          ${t.amountUsd.toFixed(2)}
                        </div>
                        <div className="mono" style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                          @{formatPrice(t.effectivePrice || t.price)}
                          {t.priceImpactPct && t.priceImpactPct > 0.05 ? ` (${t.priceImpactPct.toFixed(1)}% imp)` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons: Axiom, DexScreener, Solscan Logos */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', paddingTop: 2 }}>
                {/* Axiom Button */}
                <a
                  href={`https://axiom.trade/meme/${modalItem.mint}`}
                  target="_blank"
                  rel="noreferrer"
                  data-tooltip="Open on Axiom.trade"
                  data-tooltip-sub="Trade and view charts on Axiom"
                  data-tooltip-pos="top"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 0',
                    background: 'rgba(0, 245, 155, 0.06)',
                    border: '1px solid rgba(0, 245, 155, 0.22)',
                    borderRadius: 8,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#00f59b" strokeWidth="2" />
                    <path d="M12 7L16 16H8L12 7Z" fill="#00f59b" />
                  </svg>
                </a>

                {/* DexScreener Button */}
                <a
                  href={`https://dexscreener.com/solana/${modalItem.mint}`}
                  target="_blank"
                  rel="noreferrer"
                  data-tooltip="Open on DexScreener"
                  data-tooltip-sub="Live candlestick charts & pairs"
                  data-tooltip-pos="top"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 0',
                    background: 'rgba(56, 189, 248, 0.06)',
                    border: '1px solid rgba(56, 189, 248, 0.22)',
                    borderRadius: 8,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 14C4 9.58 7.58 6 12 6C16.42 6 20 9.58 20 14V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V14Z"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                    <circle cx="9" cy="13" r="1.5" fill="#38bdf8" />
                    <circle cx="15" cy="13" r="1.5" fill="#38bdf8" />
                    <path d="M11 16H13" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </a>

                {/* Solscan Button */}
                <a
                  href={`https://solscan.io/token/${modalItem.mint}`}
                  target="_blank"
                  rel="noreferrer"
                  data-tooltip="Open on Solscan Explorer"
                  data-tooltip-sub={`Inspect mint ${modalItem.mint.slice(0, 4)}...${modalItem.mint.slice(-4)}`}
                  data-tooltip-pos="top"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 0',
                    background: 'rgba(168, 85, 247, 0.06)',
                    border: '1px solid rgba(168, 85, 247, 0.22)',
                    borderRadius: 8,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="#a855f7" strokeWidth="2" />
                    <path d="M16.5 16.5L20.5 20.5" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
                    <path d="M9 11C9 9.89 9.89 9 11 9" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Share PnL Card Modal */}
      {shareModalData && (
        <SharePnlModal
          data={shareModalData}
          onClose={() => setShareModalData(null)}
        />
      )}

      {/* Multiple Wallets Manager Modal */}
      <WalletManagerModal
        isOpen={showWalletManager}
        wallets={wallets}
        activeWalletId={activeWalletId}
        solPriceUsd={solPriceUsd}
        onSelectWallet={handleSwitchWallet}
        onCreateWallet={handleCreateWallet}
        onRenameWallet={handleRenameWallet}
        onDeleteWallet={handleDeleteWallet}
        onExportWallet={handleExportWallet}
        onExportAll={handleExportAllWallets}
        onImportFile={handleImportWalletFile}
        onClose={() => setShowWalletManager(false)}
      />
    </div>
  );
}