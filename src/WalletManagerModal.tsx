import { useState } from 'preact/hooks';

export interface WalletPosition {
  mint: string;
  symbol: string;
  name: string;
  entryPrice: number;
  tokens: number;
  investedUsd: number;
  createdAt: number;
}

export interface WalletTradeLog {
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

export interface WalletAccount {
  id: string;
  name: string;
  address: string;
  balance: number;
  startingBalance: number;
  positions: Record<string, WalletPosition>;
  tradeHistory: WalletTradeLog[];
  createdAt: number;
}

export function generateSimulatedSolanaAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let addr = '';
  for (let i = 0; i < 44; i++) {
    addr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return addr;
}

interface WalletManagerModalProps {
  isOpen: boolean;
  wallets: WalletAccount[];
  activeWalletId: string;
  solPriceUsd: number;
  onSelectWallet: (id: string) => void;
  onCreateWallet: (name: string, initialBalance: number) => void;
  onRenameWallet: (id: string, newName: string) => void;
  onDeleteWallet: (id: string) => void;
  onExportWallet: (id: string) => void;
  onExportAll: () => void;
  onImportFile: (event: any) => void;
  onClose: () => void;
}

export function WalletManagerModal({
  isOpen,
  wallets,
  activeWalletId,
  solPriceUsd,
  onSelectWallet,
  onCreateWallet,
  onRenameWallet,
  onDeleteWallet,
  onExportWallet,
  onExportAll,
  onImportFile,
  onClose,
}: WalletManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [newWalletName, setNewWalletName] = useState<string>('');
  const [newWalletBalance, setNewWalletBalance] = useState<string>('10');
  const [copiedAddrId, setCopiedAddrId] = useState<string | null>(null);

  if (!isOpen) return null;

  const solRate = solPriceUsd || 150;

  const handleCopyAddress = (e: any, walletId: string, address: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddrId(walletId);
    setTimeout(() => setCopiedAddrId(null), 1800);
  };

  const startRename = (e: any, w: WalletAccount) => {
    e.stopPropagation();
    setEditingId(w.id);
    setEditingName(w.name);
  };

  const saveRename = (e: any, id: string) => {
    e.stopPropagation();
    const clean = editingName.trim();
    if (clean) {
      onRenameWallet(id, clean);
    }
    setEditingId(null);
  };

  const handleCreateSubmit = (e: any) => {
    e.preventDefault();
    const cleanName = newWalletName.trim() || `Wallet ${wallets.length + 1}`;
    const cleanBal = parseFloat(newWalletBalance) || 10;
    onCreateWallet(cleanName, cleanBal);
    setNewWalletName('');
    setNewWalletBalance('10');
    setShowCreateForm(false);
  };

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
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'linear-gradient(180deg, #131722 0%, #0c0e15 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.04)',
          borderRadius: 14,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          animation: 'fadeIn 0.15s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-green)' }}>
              <rect x="2" y="5" width="20" height="14" rx="3" />
              <line x1="2" y1="10" x2="22" y2="10" />
              <circle cx="17" cy="14" r="1.5" fill="currentColor" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>
              Wallets
            </span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-secondary)',
                fontFamily: 'monospace',
              }}
            >
              {wallets.length}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                background: showCreateForm ? 'rgba(0, 245, 155, 0.2)' : 'rgba(0, 245, 155, 0.1)',
                border: '1px solid rgba(0, 245, 155, 0.3)',
                borderRadius: 6,
                color: 'var(--accent-green)',
                fontSize: 10.5,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add</span>
            </button>

            <button
              onClick={onClose}
              data-tooltip="Close Modal"
              data-tooltip-pos="bottom"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 6,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Create Wallet Inline Drawer */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 10,
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(0, 245, 155, 0.2)',
              borderRadius: 8,
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-green)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Create New Paper Wallet
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Wallet Name (e.g. Degen Bag)"
                value={newWalletName}
                onChange={(e: any) => setNewWalletName(e.target.value)}
                style={{
                  flex: 2,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  color: '#fff',
                  fontSize: 11,
                  outline: 'none',
                }}
              />
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  placeholder="SOL"
                  value={newWalletBalance}
                  onChange={(e: any) => setNewWalletBalance(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 6,
                    padding: '6px 26px 6px 8px',
                    color: '#fff',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    outline: 'none',
                  }}
                />
                <span style={{ position: 'absolute', right: 6, fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, pointerEvents: 'none' }}>
                  SOL
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 5,
                  padding: '4px 10px',
                  color: 'var(--text-secondary)',
                  fontSize: 10.5,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  background: 'var(--accent-green)',
                  border: 'none',
                  borderRadius: 5,
                  padding: '4px 12px',
                  color: '#06080d',
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Create
              </button>
            </div>
          </form>
        )}

        {/* Wallet List */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 280,
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {wallets.map((w) => {
            const isActive = w.id === activeWalletId;
            const isEditing = editingId === w.id;
            const openPosCount = Object.keys(w.positions || {}).length;
            const usdValue = (w.balance * solRate).toFixed(2);
            const shortAddr = `${w.address.slice(0, 4)}...${w.address.slice(-4)}`;

            return (
              <div
                key={w.id}
                onClick={() => onSelectWallet(w.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '9px 10px',
                  borderRadius: 8,
                  background: isActive ? 'rgba(0, 245, 155, 0.07)' : 'rgba(255, 255, 255, 0.025)',
                  border: isActive ? '1px solid rgba(0, 245, 155, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e: any) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e: any) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)';
                }}
              >
                {/* Top Row: Name, Address, Active Dot, Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {isActive ? (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'var(--accent-green)',
                          boxShadow: '0 0 8px var(--accent-green)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.2)',
                          flexShrink: 0,
                        }}
                      />
                    )}

                    {isEditing ? (
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e: any) => setEditingName(e.target.value)}
                          onKeyDown={(e: any) => {
                            if (e.key === 'Enter') saveRename(e, w.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          style={{
                            background: 'rgba(0, 0, 0, 0.6)',
                            border: '1px solid var(--accent-green)',
                            borderRadius: 4,
                            padding: '1px 6px',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            outline: 'none',
                            width: 100,
                          }}
                        />
                        <button
                          onClick={(e) => saveRename(e, w.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-green)',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 130,
                        }}
                      >
                        {w.name}
                      </span>
                    )}

                    {/* Address pill with copy */}
                    <button
                      onClick={(e) => handleCopyAddress(e, w.id, w.address)}
                      data-tooltip="Copy simulated address"
                      data-tooltip-sub={w.address}
                      data-tooltip-pos="top"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 4,
                        padding: '1px 5px',
                        color: copiedAddrId === w.id ? 'var(--accent-green)' : 'var(--text-muted)',
                        fontSize: 9,
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                      }}
                    >
                      <span>{copiedAddrId === w.id ? 'Copied' : shortAddr}</span>
                    </button>
                  </div>

                  {/* Actions for this wallet */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    {/* Rename icon */}
                    {!isEditing && (
                      <button
                        onClick={(e) => startRename(e, w)}
                        data-tooltip="Rename Wallet"
                        data-tooltip-pos="top"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                          opacity: 0.7,
                        }}
                        onMouseEnter={(e: any) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e: any) => (e.currentTarget.style.opacity = '0.7')}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}

                    {/* Export Single Wallet */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportWallet(w.id);
                      }}
                      data-tooltip="Export Wallet Backup"
                      data-tooltip-sub="Download JSON file for this wallet"
                      data-tooltip-pos="top"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                        opacity: 0.7,
                      }}
                      onMouseEnter={(e: any) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e: any) => (e.currentTarget.style.opacity = '0.7')}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>

                    {/* Delete Wallet (only if > 1) */}
                    {wallets.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete wallet "${w.name}"?`)) {
                            onDeleteWallet(w.id);
                          }
                        }}
                        data-tooltip="Delete Wallet"
                        data-tooltip-sub="Permanently removes this wallet profile"
                        data-tooltip-pos="top"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-red)',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                          opacity: 0.6,
                        }}
                        onMouseEnter={(e: any) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e: any) => (e.currentTarget.style.opacity = '0.6')}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Balance, USD Value, Positions Count */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: isActive ? 'var(--accent-green)' : '#fff' }}>
                      {w.balance.toFixed(2)} SOL
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      ≈ ${usdValue}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: openPosCount > 0 ? '#fff' : 'var(--text-muted)',
                      background: openPosCount > 0 ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      padding: openPosCount > 0 ? '1px 5px' : 0,
                      borderRadius: 4,
                    }}
                  >
                    {openPosCount > 0 ? `${openPosCount} pos` : 'Flat'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: Import & Export Controls */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            paddingTop: 8,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Export All Backup */}
          <button
            onClick={onExportAll}
            data-tooltip="Export All Wallets"
            data-tooltip-sub="Download full JSON backup of all wallets & balances"
            data-tooltip-pos="top"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '7px 0',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 7,
              color: 'var(--text-secondary)',
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e: any) => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
            onMouseLeave={(e: any) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export Backup</span>
          </button>

          {/* Import Wallet Button */}
          <label
            data-tooltip="Import Wallet Backup"
            data-tooltip-sub="Upload wallet JSON backup file"
            data-tooltip-pos="top"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '7px 0',
              background: 'rgba(0, 245, 155, 0.08)',
              border: '1px solid rgba(0, 245, 155, 0.25)',
              borderRadius: 7,
              color: 'var(--accent-green)',
              fontSize: 10.5,
              fontWeight: 700,
              cursor: 'pointer',
              margin: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e: any) => (e.currentTarget.style.background = 'rgba(0, 245, 155, 0.14)')}
            onMouseLeave={(e: any) => (e.currentTarget.style.background = 'rgba(0, 245, 155, 0.08)')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Import Wallet</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={onImportFile}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
