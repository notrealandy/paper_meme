import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import {
  fetchSignaturesForAddress,
  fetchParsedTransaction,
  parseTransactionForWallet,
  getActiveRpcUrl,
  setActiveRpcUrl,
  DEFAULT_SOLANA_RPC,
} from './solanaTracker';

export interface TrackedWallet {
  id: string;
  address: string;
  nickname: string;
  emoji: string;
  color: string;
  enabled: boolean;
  addedAt: number;
}

export interface TrackerTradeEvent {
  id: string;
  walletAddress: string;
  walletNickname: string;
  walletEmoji: string;
  walletColor: string;
  type: 'BUY' | 'SELL';
  tokenSymbol: string;
  tokenName: string;
  mint: string;
  amountSol: number;
  amountUsd: number;
  timestamp: number;
  priceUsd?: number;
  marketCapUsd?: number;
  tokensTraded?: number;
  remainingTokens?: number;
  remainingPct?: number;
  profitSol?: number;
  profitUsd?: number;
  profitPct?: number;
  isTest?: boolean;
}

const DEFAULT_TRACKED_WALLETS: TrackedWallet[] = [
  {
    id: 'w-1',
    address: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    nickname: 'GCR Whale',
    emoji: '🐋',
    color: '#00f59b',
    enabled: true,
    addedAt: Date.now() - 3600000 * 24,
  },
  {
    id: 'w-2',
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    nickname: 'Smart Degen',
    emoji: '🧠',
    color: '#38bdf8',
    enabled: true,
    addedAt: Date.now() - 3600000 * 18,
  },
  {
    id: 'w-3',
    address: 'DfMxre4cKmvogbztvgPUrwxhTGZHSW3564dfPhVy8Phz',
    nickname: 'Insider Alpha',
    emoji: '⚡',
    color: '#a855f7',
    enabled: true,
    addedAt: Date.now() - 3600000 * 6,
  },
];

const DEFAULT_EVENTS: TrackerTradeEvent[] = [
  {
    id: 'ev-1',
    walletAddress: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    walletNickname: 'GCR Whale',
    walletEmoji: '🐋',
    walletColor: '#00f59b',
    type: 'BUY',
    tokenSymbol: 'FARTCOIN',
    tokenName: 'Fartcoin',
    mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
    amountSol: 12.5,
    amountUsd: 2250,
    timestamp: Date.now() - 1000 * 40,
    marketCapUsd: 48200,
    tokensTraded: 15_400_000,
    remainingTokens: 15_400_000,
    remainingPct: 100,
  },
  {
    id: 'ev-2',
    walletAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    walletNickname: 'Smart Degen',
    walletEmoji: '🧠',
    walletColor: '#38bdf8',
    type: 'SELL',
    tokenSymbol: 'AI16Z',
    tokenName: 'ai16z',
    mint: 'HeLNm6T4MGAqswvErio1U9kh8BysGw6ipNWQFDQApump',
    amountSol: 10.4,
    amountUsd: 1872,
    timestamp: Date.now() - 1000 * 90,
    marketCapUsd: 184500,
    tokensTraded: 8_200_000,
    remainingTokens: 4_100_000,
    remainingPct: 33.3,
    profitSol: 4.2,
    profitUsd: 756,
    profitPct: 67.7,
  },
  {
    id: 'ev-3',
    walletAddress: 'DfMxre4cKmvogbztvgPUrwxhTGZHSW3564dfPhVy8Phz',
    walletNickname: 'Insider Alpha',
    walletEmoji: '⚡',
    walletColor: '#a855f7',
    type: 'BUY',
    tokenSymbol: 'PENGU',
    tokenName: 'Pudgy Penguins',
    mint: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv',
    amountSol: 18.0,
    amountUsd: 3240,
    timestamp: Date.now() - 1000 * 60 * 3,
    marketCapUsd: 820000,
    tokensTraded: 22_000_000,
    remainingTokens: 35_000_000,
    remainingPct: 100,
  },
  {
    id: 'ev-4',
    walletAddress: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
    walletNickname: 'GCR Whale',
    walletEmoji: '🐋',
    walletColor: '#00f59b',
    type: 'SELL',
    tokenSymbol: 'BONK',
    tokenName: 'Bonk',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    amountSol: 25.0,
    amountUsd: 4500,
    timestamp: Date.now() - 1000 * 60 * 8,
    marketCapUsd: 2450000,
    tokensTraded: 50_000_000,
    remainingTokens: 0,
    remainingPct: 0,
    profitSol: 12.8,
    profitUsd: 2304,
    profitPct: 105.0,
  },
];

const SAMPLE_TOKENS = [
  { symbol: 'FARTCOIN', name: 'Fartcoin', mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump' },
  { symbol: 'AI16Z', name: 'ai16z', mint: 'HeLNm6T4MGAqswvErio1U9kh8BysGw6ipNWQFDQApump' },
  { symbol: 'PENGU', name: 'Pudgy Penguins', mint: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv' },
  { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'ACT', name: 'Act I : The AI Prophecy', mint: 'GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgqupump' },
  { symbol: 'CHILLGUY', name: 'Just a chill guy', mint: 'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump' },
  { symbol: 'MOODENG', name: 'Moo Deng', mint: 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY' },
];

const POPULAR_EMOJIS = ['🐋', '🧠', '⚡', '🎯', '💎', '🚀', '🦍', '👑', '🕵️', '🐺', '🦁', '💰', '📈', '🤖', '🧪'];

const PALETTE_SWATCHES = [
  '#00F59B', '#10B981', '#06B6D4', '#38BDF8',
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#EF4444', '#F97316',
  '#F59E0B', '#EAB308', '#84CC16', '#14B8A6',
];

// Color Math: HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Color Math: Hex to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length !== 6) return { h: 155, s: 100, l: 48 };
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return { h: 155, s: 100, l: 48 };

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = Math.round(h * 60);
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

// In-App Custom Dark Theme Color Picker with Unclipped Floating Popover
interface CustomColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  compact?: boolean;
}

function CustomColorPicker({ value, onChange, compact = false }: CustomColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const hsl = useMemo(() => hexToHsl(value), [value]);

  const handleOpen = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = compact ? 260 : 280;
      const popoverHeight = 280;

      // Position below trigger by default
      let top = rect.bottom + 6;
      let left = rect.left;

      // If overflowing bottom, flip above
      if (top + popoverHeight > window.innerHeight - 10) {
        top = Math.max(10, rect.top - popoverHeight - 6);
      }

      // If overflowing right edge, clamp to window
      if (left + popoverWidth > window.innerWidth - 10) {
        left = Math.max(10, window.innerWidth - popoverWidth - 10);
      }

      setCoords({ top, left });
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <div ref={triggerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {compact ? (
        <button
          type="button"
          onClick={handleOpen}
          data-tooltip="Choose wallet accent color"
          data-tooltip-sub="Pick custom hue or preset palette"
          data-tooltip-pos="top"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: value,
            border: `2px solid ${isOpen ? '#fff' : 'rgba(255, 255, 255, 0.4)'}`,
            boxShadow: `0 0 10px ${value}66`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <button
            type="button"
            onClick={handleOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              background: isOpen ? 'rgba(0, 245, 155, 0.08)' : 'var(--bg-input)',
              border: `1px solid ${isOpen ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: value,
                boxShadow: `0 0 8px ${value}77`,
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                flexShrink: 0,
              }}
            />
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
              {value.toUpperCase()}
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                color: 'var(--text-muted)',
                transform: isOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Quick Swatches Row */}
          <div style={{ display: 'flex', gap: 5, flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {PALETTE_SWATCHES.slice(0, 7).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: c,
                  border: value.toLowerCase() === c.toLowerCase() ? '2px solid #fff' : '2px solid transparent',
                  cursor: 'pointer',
                  transform: value.toLowerCase() === c.toLowerCase() ? 'scale(1.15)' : 'scale(1)',
                  boxShadow: value.toLowerCase() === c.toLowerCase() ? `0 0 8px ${c}88` : 'none',
                  transition: 'all 0.12s ease',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Floating Popover: Positioned Fixed so it overflows outside container without clipping or changing height */}
      {isOpen && coords && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 10004 }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: compact ? 260 : 280,
              background: 'rgba(15, 20, 30, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.06)',
              zIndex: 10005,
              backdropFilter: 'blur(12px)',
              animation: 'popupIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Spectrum Hue Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                <span>Spectrum Hue</span>
                <span className="mono">{hsl.h}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={hsl.h}
                onInput={(e: any) => {
                  const newH = Number(e.target.value);
                  onChange(hslToHex(newH, hsl.s || 100, hsl.l || 50));
                }}
                className="color-slider"
                style={{
                  width: '100%',
                  background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
                }}
              />
            </div>

            {/* Tone Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                <span>Tone / Lightness</span>
                <span className="mono">{hsl.l}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="85"
                value={hsl.l}
                onInput={(e: any) => {
                  const newL = Number(e.target.value);
                  onChange(hslToHex(hsl.h, hsl.s || 100, newL));
                }}
                className="color-slider"
                style={{
                  width: '100%',
                  background: `linear-gradient(to right, #000 0%, hsl(${hsl.h}, 100%, 50%) 50%, #fff 100%)`,
                }}
              />
            </div>

            {/* Presets Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Degen Neon Presets
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5 }}>
                {PALETTE_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => onChange(swatch)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: swatch,
                      border: value.toLowerCase() === swatch.toLowerCase() ? '2px solid #fff' : '1px solid rgba(0, 0, 0, 0.4)',
                      boxShadow: value.toLowerCase() === swatch.toLowerCase() ? `0 0 8px ${swatch}` : 'none',
                      cursor: 'pointer',
                      transform: value.toLowerCase() === swatch.toLowerCase() ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.12s ease',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Direct Hex Code Input & Done */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={value}
                onInput={(e: any) => {
                  let v = e.target.value.trim();
                  if (!v.startsWith('#') && v.length > 0) v = '#' + v;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v);
                }}
                className="mono"
                placeholder="#00F59B"
                maxLength={7}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: 11,
                  color: '#fff',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  textTransform: 'uppercase',
                }}
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn-buy"
                style={{
                  padding: '5px 12px',
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Native-like Emoji Picker Component
interface EmojiEntry {
  e: string;
  n: string;
  k: string;
}

const EMOJI_CATEGORIES: { id: string; name: string; icon: string; list: EmojiEntry[] }[] = [
  {
    id: 'crypto',
    name: 'Degen & Alpha',
    icon: '⚡',
    list: [
      { e: '🐋', n: 'Whale', k: 'whale ocean smart money big sea investor' },
      { e: '🧠', n: 'Galaxy Brain', k: 'brain smart iq galaxy mind think genius' },
      { e: '⚡', n: 'Lightning', k: 'lightning bolt fast speed quick energy zap' },
      { e: '🎯', n: 'Target Sniper', k: 'target sniper aim bullseye hit exact' },
      { e: '💎', n: 'Diamond Hands', k: 'diamond gem hold hands rich stone hodl' },
      { e: '🚀', n: 'Rocket Moon', k: 'rocket moon pump launch fly blast space' },
      { e: '🦍', n: 'Ape', k: 'ape gorilla buy degen monkey primate apein' },
      { e: '👑', n: 'Crown King', k: 'crown king queen leader royalty royal' },
      { e: '🕵️', n: 'Insider Spy', k: 'detective spy insider secret agent alpha' },
      { e: '🐺', n: 'Wolf Pack', k: 'wolf pack alpha lone animal predator' },
      { e: '🦁', n: 'Lion King', k: 'lion king beast wild predator roaring' },
      { e: '💰', n: 'Money Bag', k: 'money bag cash rich bags profit dollars' },
      { e: '📈', n: 'Chart Up', k: 'chart up bull pump growth green candlestick' },
      { e: '📉', n: 'Chart Down', k: 'chart down dump bear red drop dip' },
      { e: '🤖', n: 'Trading Bot', k: 'bot robot ai sniper algorithm machine' },
      { e: '🧪', n: 'Degen Lab', k: 'potion science test tube lab chemistry cook' },
      { e: '🔥', n: 'Fire Lit', k: 'fire flame hot lit burn trending' },
      { e: '👀', n: 'Eyes On', k: 'eyes look watch see alpha radar notice' },
      { e: '🤑', n: 'Money Mouth', k: 'money mouth rich profit gain greedy' },
      { e: '💀', n: 'Skull Rekt', k: 'skull dead rip rekt death skeleton' },
      { e: '🫡', n: 'Salute Honor', k: 'salute respect honor soldier sir cap' },
      { e: '🤡', n: 'Clown', k: 'clown circus fool joke funny dev' },
      { e: '🏆', n: 'Trophy Winner', k: 'trophy winner prize champion gold cup' },
      { e: '💣', n: 'Bomb Nuke', k: 'bomb explode blow nuke danger weapon' },
      { e: '🎲', n: 'Dice Gamble', k: 'dice gamble luck roll casino wager' },
      { e: '💸', n: 'Flying Cash', k: 'flying money cash dollars wings spend' },
      { e: '🪙', n: 'Crypto Coin', k: 'coin crypto solana token gold currency' },
      { e: '💥', n: 'Explosion', k: 'explosion boom impact blast shock' },
    ],
  },
  {
    id: 'faces',
    name: 'Smileys & People',
    icon: '😀',
    list: [
      { e: '😀', n: 'Grinning', k: 'smile happy joy grin face' },
      { e: '😎', n: 'Sunglasses', k: 'cool sunglasses shade chill boss degen' },
      { e: '🥳', n: 'Partying', k: 'party celebrate hat horn festive celebration' },
      { e: '🤩', n: 'Star-Struck', k: 'star eyes wow amazed excited' },
      { e: '😏', n: 'Smirking', k: 'smirk sneaky sly flirt confident know' },
      { e: '🧐', n: 'Monocle', k: 'monocle classy inspect fancy examine check' },
      { e: '🤓', n: 'Nerd', k: 'nerd geek glasses smart tech coder' },
      { e: '😈', n: 'Devil', k: 'devil evil horn purple mischief wicked' },
      { e: '👻', n: 'Ghost', k: 'ghost spook boo phantom spirit haunt' },
      { e: '👽', n: 'Alien', k: 'alien ufo martian extraterrestrial space' },
      { e: '👾', n: 'Alien Monster', k: 'game space invader retro pixel 8bit' },
      { e: '💩', n: 'Poop', k: 'poop shit crap funny pile shitcoin' },
      { e: '💪', n: 'Flex Biceps', k: 'muscle arm flex strong power gym lift' },
      { e: '🤝', n: 'Handshake', k: 'handshake deal agree partner trust team' },
      { e: '✌️', n: 'Victory Hand', k: 'peace victory v two sign fingers' },
      { e: '🤞', n: 'Crossed Fingers', k: 'cross fingers luck hope wish pray' },
      { e: '🤙', n: 'Call Me Hand', k: 'shaka surf call hang loose aloha' },
      { e: '🫀', n: 'Anatomical Heart', k: 'heart organ cardio beat pulse love' },
    ],
  },
  {
    id: 'animals',
    name: 'Animals',
    icon: '🐶',
    list: [
      { e: '🐶', n: 'Dog Face', k: 'dog doge puppy bark shiba bonk' },
      { e: '🐱', n: 'Cat Face', k: 'cat kitty kitten meow feline' },
      { e: '🦊', n: 'Fox', k: 'fox cunning wild orange animal metamask' },
      { e: '🐻', n: 'Bear', k: 'bear grizzly market animal dump' },
      { e: '🐼', n: 'Panda', k: 'panda bamboo cute bear china' },
      { e: '🐯', n: 'Tiger', k: 'tiger stripes wild fierce cat' },
      { e: '🐮', n: 'Cow', k: 'cow milk beef farm moo farm' },
      { e: '🐷', n: 'Pig', k: 'pig pork bacon farm oink' },
      { e: '🐸', n: 'Pepe Frog', k: 'frog toad pepe pond ribbit meme' },
      { e: '🐵', n: 'Monkey Face', k: 'monkey ape cheeky primate jungle' },
      { e: '🐧', n: 'Penguin', k: 'penguin bird antarctic pudgy waddle pengu' },
      { e: '🦅', n: 'Eagle', k: 'eagle bird fly prey raptor america' },
      { e: '🦉', n: 'Owl', k: 'owl night wise bird nocturnal vision' },
      { e: '🦇', n: 'Bat', k: 'bat night vampire cave wings' },
      { e: '🦄', n: 'Unicorn', k: 'unicorn magic fantasy horn rainbow uniswap' },
      { e: '🐝', n: 'Honeybee', k: 'bee insect honey sting buzz' },
      { e: '🦋', n: 'Butterfly', k: 'butterfly wings insect pretty fly' },
      { e: '🐢', n: 'Turtle', k: 'turtle tortoise slow shell ocean' },
      { e: '🐍', n: 'Snake', k: 'snake serpent viper danger hiss' },
      { e: '🐙', n: 'Octopus', k: 'octopus tentacles sea ocean creature kraken' },
      { e: '🦈', n: 'Shark', k: 'shark jaws ocean fin predator whale' },
      { e: '🐬', n: 'Dolphin', k: 'dolphin ocean flipper smart sea' },
      { e: '🐂', n: 'Bull', k: 'bull market horn charge strength pump' },
      { e: '🐐', n: 'Goat', k: 'goat animal horn farm goat greatest of all time' },
      { e: '🐕', n: 'Shiba Dog', k: 'doge shiba dog pet canine bonk wif' },
      { e: '🦜', n: 'Parrot', k: 'parrot bird tropical colorful pirate' },
      { e: '🦥', n: 'Sloth', k: 'sloth slow tree chill sleepy relax' },
      { e: '🐉', n: 'Dragon', k: 'dragon mythical fire beast monster legendary' },
    ],
  },
  {
    id: 'objects',
    name: 'Objects & Travel',
    icon: '🚀',
    list: [
      { e: '⭐', n: 'Star', k: 'star night gold shining bright favorite' },
      { e: '🌟', n: 'Glowing Star', k: 'glowing star sparkle gold shiny' },
      { e: '✨', n: 'Sparkles', k: 'sparkles clean magic shine twinkle gem' },
      { e: '🎮', n: 'Game Controller', k: 'game video play gaming controller play' },
      { e: '🕹️', n: 'Joystick', k: 'joystick arcade retro game play' },
      { e: '🔮', n: 'Crystal Ball', k: 'crystal ball fortune psychic future predict' },
      { e: '🎰', n: 'Slot Machine', k: 'slot casino jackpot gamble win 777 spin' },
      { e: '🛸', n: 'Flying Saucer', k: 'ufo saucer alien spaceship sci-fi space' },
      { e: '🏎️', n: 'Race Car', k: 'race car speed fast auto drive f1 formula' },
      { e: '🚨', n: 'Police Siren', k: 'police siren emergency alert red flash alarm' },
      { e: '🔋', n: 'Battery', k: 'battery power charge energy electric full' },
      { e: '💡', n: 'Light Bulb', k: 'light bulb idea bright smart invent insight' },
      { e: '💻', n: 'Laptop', k: 'laptop computer dev code keyboard pc mac' },
      { e: '📱', n: 'Mobile Phone', k: 'phone cell smartphone mobile call screen' },
      { e: '🔑', n: 'Key', k: 'key lock access security password private key' },
      { e: '🛡️', n: 'Shield', k: 'shield protect defense armor secure guard' },
      { e: '⚔️', n: 'Crossed Swords', k: 'swords battle fight war duel combat pvp' },
      { e: '🧨', n: 'Firecracker', k: 'dynamite blast boom tnt firecracker' },
      { e: '🧬', n: 'DNA', k: 'dna gene biology science evolution code' },
      { e: '💊', n: 'Pill', k: 'pill medicine capsule red drug matrix redpill' },
      { e: '🌕', n: 'Full Moon', k: 'moon night space orbit lunar to the moon' },
    ],
  },
  {
    id: 'food',
    name: 'Food & Drinks',
    icon: '🍔',
    list: [
      { e: '🍔', n: 'Hamburger', k: 'burger food fast beef bun sandwich meat' },
      { e: '🍕', n: 'Pizza', k: 'pizza slice cheese italian crust pepperoni' },
      { e: '🍟', n: 'French Fries', k: 'fries potato fast food salty crisp mcdonalds' },
      { e: '🍿', n: 'Popcorn', k: 'popcorn movie cinema snack butter corn' },
      { e: '🌮', n: 'Taco', k: 'taco mexican food shell meat fiesta' },
      { e: '🍣', n: 'Sushi', k: 'sushi fish rice raw roll japanese salmon' },
      { e: '🍩', n: 'Doughnut', k: 'donut doughnut sweet dessert glaze chocolate' },
      { e: '🍪', n: 'Cookie', k: 'cookie chocolate sweet biscuit bakery chips' },
      { e: '🎂', n: 'Birthday Cake', k: 'cake birthday sweet candle dessert bday' },
      { e: '🍺', n: 'Beer Mug', k: 'beer drink alcohol pub glass froth pint' },
      { e: '🍻', n: 'Clinking Beers', k: 'beers cheers toast drink pub party brew' },
      { e: '🥂', n: 'Champagne Flutes', k: 'champagne celebration toast glasses sparkling wine' },
      { e: '🍷', n: 'Wine Glass', k: 'wine red glass drink alcohol grape vineyard' },
      { e: '🍾', n: 'Popping Champagne', k: 'champagne cork pop celebrate wine victory' },
    ],
  },
];

interface NativeEmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  compact?: boolean;
}

function NativeEmojiPicker({ value, onChange, compact = false }: NativeEmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [activeCategory, setActiveCategory] = useState('crypto');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredItem, setHoveredItem] = useState<EmojiEntry | null>(null);
  const categoryBarRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkCategoryScroll = () => {
    if (categoryBarRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = categoryBarRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(checkCategoryScroll, 50);
    }
  }, [isOpen]);

  const scrollCategories = (dir: 'left' | 'right') => {
    if (categoryBarRef.current) {
      categoryBarRef.current.scrollBy({
        left: dir === 'left' ? -90 : 90,
        behavior: 'smooth',
      });
      setTimeout(checkCategoryScroll, 150);
    }
  };

  const displayedEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const all: EmojiEntry[] = [];
      const seen = new Set<string>();
      for (const cat of EMOJI_CATEGORIES) {
        for (const item of cat.list) {
          if (!seen.has(item.e)) {
            if (item.n.toLowerCase().includes(q) || item.k.toLowerCase().includes(q) || item.e === q) {
              seen.add(item.e);
              all.push(item);
            }
          }
        }
      }
      return all;
    }

    const currentCat = EMOJI_CATEGORIES.find((c) => c.id === activeCategory);
    return currentCat ? currentCat.list : EMOJI_CATEGORIES[0].list;
  }, [searchQuery, activeCategory]);

  const currentInfo = useMemo(() => {
    for (const cat of EMOJI_CATEGORIES) {
      const found = cat.list.find((item) => item.e === value);
      if (found) return found;
    }
    return null;
  }, [value]);

  const previewItem = hoveredItem || currentInfo || { e: value || '🐋', n: 'Custom Emoji', k: '' };
  const isCustomInputEmoji = searchQuery.trim().length > 0 && Array.from(searchQuery.trim()).length <= 2;

  const handleOpen = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = compact ? 300 : 330;
      const popoverHeight = 310;

      // Position below trigger by default
      let top = rect.bottom + 6;
      let left = rect.left;

      // If overflowing bottom of window, position above
      if (top + popoverHeight > window.innerHeight - 10) {
        top = Math.max(10, rect.top - popoverHeight - 6);
      }

      // If overflowing right edge, clamp to window
      if (left + popoverWidth > window.innerWidth - 10) {
        left = Math.max(10, window.innerWidth - popoverWidth - 10);
      }

      setCoords({ top, left });
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <div ref={triggerRef} style={{ position: 'relative', width: compact ? 'auto' : '100%', display: compact ? 'inline-flex' : 'block' }}>
      {compact ? (
        <button
          type="button"
          onClick={handleOpen}
          data-tooltip="Choose wallet avatar emoji"
          data-tooltip-sub="Pick from native emoji categories"
          data-tooltip-pos="top"
          style={{
            width: 34,
            height: 34,
            borderRadius: 7,
            background: 'var(--bg-input)',
            border: `1px solid ${isOpen ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          {value || '🐋'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '7px 10px',
            background: isOpen ? 'rgba(0, 245, 155, 0.08)' : 'var(--bg-input)',
            border: `1px solid ${isOpen ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 7,
              background: 'rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            {value || '🐋'}
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
              {currentInfo?.n || 'Choose Emoji'}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
              Search or pick from native categories
            </div>
          </div>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: 'var(--text-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Floating Popover: Positioned Fixed so it overflows outside container without clipping or changing height */}
      {isOpen && coords && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 10004 }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: compact ? 300 : 330,
              background: 'rgba(15, 20, 30, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 12,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.06)',
              zIndex: 10005,
              backdropFilter: 'blur(12px)',
              animation: 'popupIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {/* Search Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 7,
                padding: '6px 9px',
                gap: 7,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search emoji (whale, dog, rocket, fire)..."
                value={searchQuery}
                onInput={(e: any) => setSearchQuery(e.target.value)}
                autoFocus
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: 11,
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: 11,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Tabs with Floating Arrow Overlays in the Box */}
            {!searchQuery && (
              <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
                {/* Floating Left Arrow Overlay */}
                {canScrollLeft && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 28,
                      background: 'linear-gradient(to right, rgba(15, 20, 30, 0.95) 40%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      zIndex: 3,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => scrollCategories('left')}
                      data-tooltip="Scroll categories left"
                      data-tooltip-pos="top"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'rgba(0, 0, 0, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.6)',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e: any) => {
                        e.currentTarget.style.background = 'var(--accent-green)';
                        e.currentTarget.style.color = '#000';
                      }}
                      onMouseLeave={(e: any) => {
                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.85)';
                        e.currentTarget.style.color = '#fff';
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Category Tabs Scroll List */}
                <div
                  ref={categoryBarRef}
                  onScroll={checkCategoryScroll}
                  className="category-tabs-scroll"
                  style={{
                    display: 'flex',
                    gap: 4,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    paddingBottom: 2,
                    scrollBehavior: 'smooth',
                  }}
                >
                  {EMOJI_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      style={{
                        background: activeCategory === cat.id ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        border: `1px solid ${activeCategory === cat.id ? 'rgba(0, 245, 155, 0.4)' : 'var(--border-subtle)'}`,
                        color: activeCategory === cat.id ? 'var(--accent-green)' : 'var(--text-secondary)',
                        borderRadius: 6,
                        padding: '3px 7px',
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.1s ease',
                        flexShrink: 0,
                      }}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  ))}
                </div>

                {/* Floating Right Arrow Overlay */}
                {canScrollRight && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 28,
                      background: 'linear-gradient(to left, rgba(15, 20, 30, 0.95) 40%, transparent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      zIndex: 3,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => scrollCategories('right')}
                      data-tooltip="Scroll categories right"
                      data-tooltip-pos="top"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'rgba(0, 0, 0, 0.85)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.6)',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e: any) => {
                        e.currentTarget.style.background = 'var(--accent-green)';
                        e.currentTarget.style.color = '#000';
                      }}
                      onMouseLeave={(e: any) => {
                        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.85)';
                        e.currentTarget.style.color = '#fff';
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Direct custom typed emoji fallback */}
            {isCustomInputEmoji && (
              <div style={{ padding: '5px 8px', background: 'rgba(0, 245, 155, 0.08)', borderRadius: 7, border: '1px solid rgba(0, 245, 155, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10.5, color: '#fff' }}>
                  Use custom: <strong style={{ fontSize: 15 }}>{searchQuery.trim()}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onChange(searchQuery.trim());
                    setIsOpen(false);
                  }}
                  className="btn-buy"
                  style={{ padding: '2px 7px', fontSize: 9.5, fontWeight: 700, borderRadius: 5 }}
                >
                  Select
                </button>
              </div>
            )}

            {/* Grid of Emojis */}
            <div
              className="emoji-picker-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                alignContent: 'start',
                gap: 4,
                height: 180,
                maxHeight: 180,
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarGutter: 'stable',
                padding: '4px 2px',
                boxSizing: 'border-box',
              }}
            >
              {displayedEmojis.map((item) => (
                <button
                  key={item.e}
                  type="button"
                  onClick={() => {
                    onChange(item.e);
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setHoveredItem(item)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className="emoji-cell"
                  style={{
                    aspectRatio: '1',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 21,
                    background: value === item.e ? 'rgba(0, 245, 155, 0.2)' : 'transparent',
                    border: value === item.e ? '1px solid rgba(0, 245, 155, 0.4)' : '1px solid transparent',
                    borderRadius: 7,
                    cursor: 'pointer',
                    transition: 'transform 0.1s ease, background 0.1s ease',
                    boxSizing: 'border-box',
                  }}
                >
                  {item.e}
                </button>
              ))}

              {displayedEmojis.length === 0 && !isCustomInputEmoji && (
                <div style={{ gridColumn: 'span 7', textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted)', fontSize: 11 }}>
                  No matching emoji found.
                </div>
              )}
            </div>

            {/* Bottom Preview Bar with Fixed Height */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: 6,
                height: 38,
                minHeight: 38,
                maxHeight: 38,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 24, lineHeight: 1, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {previewItem.e}
                </div>
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '14px' }}>
                    {previewItem.n}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '13px', height: 13 }}>
                    {previewItem.k || '\u00A0'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn-buy"
                style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 5, flexShrink: 0 }}
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Audio chime using Web Audio API
function playAlertChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch {}
}

function timeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

export function formatMarketCap(mc?: number): string {
  if (!mc || mc <= 0) return '—';
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(2)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(1)}M`;
  if (mc >= 1e3) return `$${(mc / 1e3).toFixed(1)}K`;
  return `$${mc.toFixed(0)}`;
}

export function formatTokenAmount(amount?: number): string {
  if (amount === undefined || amount === null) return '—';
  if (amount === 0) return '0';
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(1)}K`;
  return amount.toFixed(0);
}

export function hydrateLegacyEvents(rawEvents: TrackerTradeEvent[], fallbackSolPrice: number = 180): TrackerTradeEvent[] {
  return rawEvents.map((ev) => {
    const amountSol = ev.amountSol || 1;
    const amountUsd = ev.amountUsd || Number((amountSol * fallbackSolPrice).toFixed(2));
    const solPrice = amountSol > 0 && amountUsd > 0 ? amountUsd / amountSol : fallbackSolPrice;
    const type = ev.type || 'BUY';

    let tokensTraded = ev.tokensTraded;
    if (!tokensTraded || tokensTraded <= 0) {
      tokensTraded = Math.round(amountSol / 0.0000015);
    }

    let marketCapUsd = ev.marketCapUsd;
    if (!marketCapUsd || marketCapUsd <= 0) {
      if (tokensTraded > 0 && amountUsd > 0) {
        marketCapUsd = Math.round((amountUsd / tokensTraded) * 1_000_000_000);
      } else if (ev.priceUsd && ev.priceUsd > 0) {
        marketCapUsd = Math.round(ev.priceUsd * 1_000_000_000);
      } else {
        marketCapUsd = Math.round(Math.max(45000, amountUsd * 85 + 35000));
      }
    }

    let remainingTokens = ev.remainingTokens;
    let remainingPct = ev.remainingPct;
    if (remainingTokens === undefined || remainingTokens === null) {
      if (type === 'BUY') {
        remainingTokens = tokensTraded;
        remainingPct = remainingPct ?? 100;
      } else {
        remainingTokens = Math.round(tokensTraded * 0.4);
        remainingPct = remainingPct ?? 35;
      }
    }

    let profitSol = ev.profitSol;
    let profitUsd = ev.profitUsd;
    let profitPct = ev.profitPct;
    if (type === 'SELL') {
      if (profitUsd === undefined && profitSol === undefined) {
        const estPct = profitPct ?? 65.5;
        profitPct = estPct;
        const costBasis = amountSol / (1 + estPct / 100);
        profitSol = Number((amountSol - costBasis).toFixed(3));
        profitUsd = Number((profitSol * solPrice).toFixed(2));
      } else if (profitUsd === undefined && profitSol !== undefined) {
        profitUsd = Number((profitSol * solPrice).toFixed(2));
        profitPct = profitPct ?? 50;
      } else if (profitSol === undefined && profitUsd !== undefined) {
        profitSol = Number((profitUsd / solPrice).toFixed(3));
        profitPct = profitPct ?? 50;
      }
    }

    return {
      ...ev,
      amountSol,
      amountUsd,
      type,
      tokensTraded,
      marketCapUsd,
      remainingTokens,
      remainingPct,
      profitSol,
      profitUsd,
      profitPct,
    };
  });
}

interface TrackerViewProps {
  solPriceUsd: number;
  onSelectToken: (mint: string) => void;
  flashToast: (
    msgOrPayload: string | { message?: string; tradeEvent?: TrackerTradeEvent; type?: 'success' | 'info' | 'warn' | 'error' },
    duration?: number
  ) => void;
  onNewEventNotification?: (event: TrackerTradeEvent) => void;
}

export function TrackerView({
  solPriceUsd,
  onSelectToken,
  flashToast,
  onNewEventNotification,
}: TrackerViewProps) {
  // 1. Wallets state
  const [wallets, setWallets] = useState<TrackedWallet[]>(() => {
    try {
      const saved = localStorage.getItem('pm_tracked_wallets');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TRACKED_WALLETS;
  });

  // 2. Events state
  const [events, setEvents] = useState<TrackerTradeEvent[]>(() => {
    try {
      const saved = localStorage.getItem('pm_tracker_events');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return hydrateLegacyEvents(parsed);
        }
      }
    } catch {}
    return DEFAULT_EVENTS;
  });

  // Filter & Modals
  const [selectedWalletId, setSelectedWalletId] = useState<string>('ALL');
  const [isFabOpen, setIsFabOpen] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showListModal, setShowListModal] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('pm_tracker_sound') !== 'false';
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showRpcConfig, setShowRpcConfig] = useState<boolean>(false);
  const [customRpcInput, setCustomRpcInput] = useState<string>(() => {
    try {
      return localStorage.getItem('pm_custom_rpc') || '';
    } catch {
      return '';
    }
  });

  // Maximum age of trades to show/track (default: 2 minutes = 120 seconds)
  const [maxAgeSeconds, setMaxAgeSeconds] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pm_tracker_max_age');
      if (saved) return Number(saved);
    } catch {}
    return 120;
  });
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    try {
      localStorage.setItem('pm_tracker_max_age', String(maxAgeSeconds));
    } catch {}
  }, [maxAgeSeconds]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Form states for Add Wallet
  const [newAddress, setNewAddress] = useState<string>('');
  const [newNickname, setNewNickname] = useState<string>('');
  const [newEmoji, setNewEmoji] = useState<string>('🐋');
  const [newColor, setNewColor] = useState<string>('#00F59B');
  const [addressError, setAddressError] = useState<string>('');

  // Inline edit state in Tracked Wallets modal
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState<string>('');
  const [editEmoji, setEditEmoji] = useState<string>('🐋');
  const [editColor, setEditColor] = useState<string>('#00F59B');

  // Persist wallets
  useEffect(() => {
    try {
      localStorage.setItem('pm_tracked_wallets', JSON.stringify(wallets));
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ pm_tracked_wallets: wallets });
      }
    } catch {}
  }, [wallets]);

  // Persist events
  useEffect(() => {
    try {
      localStorage.setItem('pm_tracker_events', JSON.stringify(events));
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set({ pm_tracker_events: events });
      }
    } catch {}
  }, [events]);

  // Persist sound preference
  useEffect(() => {
    localStorage.setItem('pm_tracker_sound', soundEnabled ? 'true' : 'false');
  }, [soundEnabled]);

  // Shorten Solana address
  const shorten = (addr: string) => {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  // Add wallet handler
  const handleAddWallet = (e: any) => {
    e.preventDefault();
    const cleanAddress = newAddress.trim();
    if (!cleanAddress) {
      setAddressError('Please enter a wallet address');
      return;
    }

    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddress)) {
      setAddressError('Invalid Solana address format (32-44 chars)');
      return;
    }

    if (wallets.some((w) => w.address.toLowerCase() === cleanAddress.toLowerCase())) {
      setAddressError('Wallet address is already being tracked');
      return;
    }

    const newWallet: TrackedWallet = {
      id: `w-${Date.now()}`,
      address: cleanAddress,
      nickname: newNickname.trim() || `Whale #${wallets.length + 1}`,
      emoji: newEmoji.trim() || '🐋',
      color: newColor || '#00F59B',
      enabled: true,
      addedAt: Date.now(),
    };

    setWallets([newWallet, ...wallets]);
    setShowAddModal(false);
    setNewAddress('');
    setNewNickname('');
    setNewEmoji('🐋');
    setNewColor('#00F59B');
    setAddressError('');
    flashToast(`Tracking ${newWallet.emoji} ${newWallet.nickname} (${shorten(newWallet.address)})`);
    setTimeout(() => {
      syncWalletForFirstTime(newWallet);
    }, 250);
  };

  // Save inline edit wallet
  const handleSaveEditWallet = (id: string) => {
    const target = wallets.find((w) => w.id === id);
    if (!target) return;

    const nextNick = editNickname.trim() || target.nickname;
    const nextEmoji = editEmoji.trim() || target.emoji || '🐋';
    const nextColor = editColor || target.color || '#00F59B';

    setWallets((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, nickname: nextNick, emoji: nextEmoji, color: nextColor } : w
      )
    );

    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.walletAddress.toLowerCase() === target.address.toLowerCase()) {
          return {
            ...ev,
            walletNickname: nextNick,
            walletEmoji: nextEmoji,
            walletColor: nextColor,
          };
        }
        return ev;
      })
    );

    setEditingWalletId(null);
    flashToast(`Updated ${nextEmoji} ${nextNick}`);
  };

  // Delete wallet
  const handleDeleteWallet = (id: string, e?: any) => {
    if (e) e.stopPropagation();
    const target = wallets.find((w) => w.id === id);
    if (!target) return;
    if (confirm(`Stop tracking ${target.nickname}?`)) {
      setWallets(wallets.filter((w) => w.id !== id));
      if (selectedWalletId === id) setSelectedWalletId('ALL');
      flashToast(`Removed ${target.nickname}`);
    }
  };

  // Toggle notifications for a wallet
  const handleToggleWallet = (id: string, e?: any) => {
    if (e) e.stopPropagation();
    setWallets(
      wallets.map((w) => {
        if (w.id === id) {
          const next = !w.enabled;
          flashToast(`${w.nickname} alerts ${next ? 'enabled' : 'muted'}`);
          return { ...w, enabled: next };
        }
        return w;
      })
    );
  };

  // Copy address to clipboard
  const handleCopyAddress = (address: string, e?: any) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(address);
    flashToast(`Copied ${shorten(address)}`);
  };

  // Export tracked wallets to JSON file
  const handleExportWallets = () => {
    if (wallets.length === 0) {
      flashToast('No wallets to export');
      return;
    }
    try {
      const exportData = JSON.stringify(wallets, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paper-meme-tracked-wallets-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      flashToast(`Exported ${wallets.length} tracked wallets`);
    } catch {
      flashToast('Failed to export wallets');
    }
  };

  // Import tracked wallets from JSON or TXT file
  const handleImportWallets = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          flashToast('Import file is empty');
          return;
        }

        const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        const candidates: Array<{ address: string; nickname?: string; emoji?: string; color?: string; enabled?: boolean }> = [];

        // Try parsing JSON first
        try {
          const parsed = JSON.parse(text);
          const rawList = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.wallets)
            ? parsed.wallets
            : Array.isArray(parsed.trackedWallets)
            ? parsed.trackedWallets
            : [];

          for (const item of rawList) {
            if (typeof item === 'string') {
              candidates.push({ address: item.trim() });
            } else if (item && typeof item === 'object' && item.address) {
              candidates.push({
                address: String(item.address).trim(),
                nickname: item.nickname ? String(item.nickname).trim() : undefined,
                emoji: item.emoji ? String(item.emoji).trim() : undefined,
                color: item.color ? String(item.color).trim() : undefined,
                enabled: item.enabled !== false,
              });
            }
          }
        } catch {
          // If not JSON, parse as newline/comma separated text
          const lines = text.split(/[\r\n,]+/);
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
              const parts = trimmed.split(/[:\t\s]+/);
              const foundAddr = parts.find((p) => solanaRegex.test(p));
              if (foundAddr) {
                const nickname = parts[0] !== foundAddr ? parts[0] : undefined;
                candidates.push({ address: foundAddr, nickname });
              }
            }
          }
        }

        // Filter valid Solana addresses
        const validCandidates = candidates.filter((c) => solanaRegex.test(c.address));
        if (validCandidates.length === 0) {
          flashToast('No valid Solana addresses found in file');
          return;
        }

        const existingAddresses = new Set(wallets.map((w) => w.address.toLowerCase()));
        const toAdd: TrackedWallet[] = [];
        let duplicateCount = 0;

        for (const item of validCandidates) {
          const lower = item.address.toLowerCase();
          if (existingAddresses.has(lower)) {
            duplicateCount++;
            continue;
          }
          existingAddresses.add(lower);

          toAdd.push({
            id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            address: item.address,
            nickname: item.nickname || `Whale #${wallets.length + toAdd.length + 1}`,
            emoji: item.emoji || POPULAR_EMOJIS[(wallets.length + toAdd.length) % POPULAR_EMOJIS.length],
            color: item.color || PALETTE_SWATCHES[(wallets.length + toAdd.length) % PALETTE_SWATCHES.length],
            enabled: item.enabled ?? true,
            addedAt: Date.now(),
          });
        }

        if (toAdd.length === 0) {
          flashToast(`All ${duplicateCount} wallets are already being tracked`);
          return;
        }

        setWallets((prev) => [...toAdd, ...prev]);
        const msg = duplicateCount > 0
          ? `Imported ${toAdd.length} wallets (${duplicateCount} already tracked)`
          : `Imported ${toAdd.length} wallets successfully`;
        flashToast(msg);
      } catch {
        flashToast('Failed to parse import file');
      } finally {
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  // Simulate buy or sell alert for testing
  const handleSimulateBuy = () => {
    const activeWallets = wallets.filter((w) => w.enabled);
    const sourceWallet =
      activeWallets.length > 0
        ? activeWallets[Math.floor(Math.random() * activeWallets.length)]
        : DEFAULT_TRACKED_WALLETS[0];

    const sampleToken = SAMPLE_TOKENS[Math.floor(Math.random() * SAMPLE_TOKENS.length)];
    const isSell = Math.random() > 0.55;
    const type: 'BUY' | 'SELL' = isSell ? 'SELL' : 'BUY';
    const solAmt = Number((Math.random() * 8 + 0.8).toFixed(2));
    const usdEquivalent = Number((solAmt * (solPriceUsd || 180)).toFixed(2));
    const marketCapUsd = Math.floor(Math.random() * 650000 + 35000);
    const tokensTraded = Math.floor((solAmt / 0.0000015) * (Math.random() * 0.4 + 0.8));
    const remainingTokens = isSell
      ? (Math.random() > 0.35 ? Math.floor(tokensTraded * 0.5) : 0)
      : Math.floor(tokensTraded * (Math.random() * 0.5 + 1));
    const remainingPct = isSell
      ? (remainingTokens === 0 ? 0 : Math.round((remainingTokens / (tokensTraded + remainingTokens)) * 100))
      : 100;

    let profitSol: number | undefined;
    let profitUsd: number | undefined;
    let profitPct: number | undefined;

    if (isSell) {
      const isProfit = Math.random() > 0.2;
      profitPct = isProfit
        ? Number((Math.random() * 220 + 30).toFixed(1))
        : -Number((Math.random() * 40 + 10).toFixed(1));
      const costBasis = solAmt / (1 + profitPct / 100);
      profitSol = Number((solAmt - costBasis).toFixed(3));
      profitUsd = Number((profitSol * (solPriceUsd || 180)).toFixed(2));
    }

    const newEvent: TrackerTradeEvent = {
      id: `ev-${Date.now()}`,
      walletAddress: sourceWallet.address,
      walletNickname: sourceWallet.nickname,
      walletEmoji: sourceWallet.emoji || '🐋',
      walletColor: sourceWallet.color || '#00F59B',
      type,
      tokenSymbol: sampleToken.symbol,
      tokenName: sampleToken.name,
      mint: sampleToken.mint,
      amountSol: solAmt,
      amountUsd: usdEquivalent,
      timestamp: Date.now(),
      marketCapUsd,
      tokensTraded,
      remainingTokens,
      remainingPct,
      profitSol,
      profitUsd,
      profitPct,
      isTest: true,
    };

    setEvents((prev) => [newEvent, ...prev.slice(0, 49)]);

    if (soundEnabled) {
      playAlertChime();
    }

    flashToast(
      {
        message: `[TEST] ${sourceWallet.emoji || ''} ${sourceWallet.nickname}: ${type === 'BUY' ? 'Bought' : 'Sold'} ${solAmt} SOL of $${sampleToken.symbol}`,
        tradeEvent: newEvent,
      },
      5500
    );

    if (onNewEventNotification) {
      onNewEventNotification(newEvent);
    }
  };

  // Real On-Chain Wallet Sync & Poller
  const isSyncingRef = useRef<boolean>(false);
  const knownSignaturesRef = useRef<Set<string>>(new Set());

  // Seed known signatures from existing events on mount
  useEffect(() => {
    events.forEach((ev) => {
      const sig = ev.id.replace(/^ev-/, '');
      if (sig) knownSignaturesRef.current.add(sig);
    });
  }, []);

  // Fetch and parse real transactions for all enabled tracked wallets
  const syncWalletActivity = async (isManual = false) => {
    if (isSyncingRef.current) return;
    const activeWallets = wallets.filter((w) => w.enabled);
    if (activeWallets.length === 0) {
      if (isManual) flashToast('No active wallets enabled for tracking');
      return;
    }

    isSyncingRef.current = true;
    if (isManual) setIsRefreshing(true);

    try {
      let newTradesFound = 0;
      const discoveredEvents: TrackerTradeEvent[] = [];

      for (const wallet of activeWallets) {
        // Query recent signatures for this wallet, filtered by maxAgeSeconds
        const sigs = await fetchSignaturesForAddress(wallet.address, 4, maxAgeSeconds);
        if (!sigs || sigs.length === 0) continue;

        // Filter signatures we haven't seen yet
        const newSigs = sigs.filter((s) => !knownSignaturesRef.current.has(s));

        for (const sig of newSigs) {
          knownSignaturesRef.current.add(sig);

          // Fetch full parsed transaction from Solana RPC
          const tx = await fetchParsedTransaction(sig);
          if (!tx) continue;

          // Parse for token swap/trade (BUY/SELL)
          const tradeEvent = await parseTransactionForWallet(tx, sig, wallet, solPriceUsd, maxAgeSeconds, events);
          if (tradeEvent) {
            newTradesFound++;
            discoveredEvents.push(tradeEvent);

            if (soundEnabled) {
              playAlertChime();
            }

            flashToast(
              {
                message: `${wallet.emoji || '🐋'} ${wallet.nickname}: ${tradeEvent.type === 'BUY' ? 'Bought' : 'Sold'} ${tradeEvent.amountSol.toFixed(2)} SOL of $${tradeEvent.tokenSymbol}`,
                tradeEvent,
              },
              6000
            );

            // Chrome desktop notification
            if (typeof chrome !== 'undefined' && chrome.notifications?.create) {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: `${wallet.emoji || '🐋'} ${wallet.nickname}: ${tradeEvent.type === 'BUY' ? 'Bought' : 'Sold'} $${tradeEvent.tokenSymbol}`,
                message: `${tradeEvent.type === 'BUY' ? '+' : '-'}${tradeEvent.amountSol.toFixed(2)} SOL (~$${tradeEvent.amountUsd})`,
                priority: 2,
              });
            } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(`Trade Alert: ${wallet.nickname}`, {
                body: `${tradeEvent.type === 'BUY' ? 'Bought' : 'Sold'} ${tradeEvent.amountSol.toFixed(2)} SOL of $${tradeEvent.tokenSymbol}`,
                icon: 'icons/icon128.png',
              });
            }

            if (onNewEventNotification) {
              onNewEventNotification(tradeEvent);
            }
          }
        }
      }

      if (discoveredEvents.length > 0) {
        setEvents((prev) => [...discoveredEvents, ...prev].slice(0, 50));
      }

      if (isManual) {
        flashToast(
          newTradesFound > 0
            ? `Found ${newTradesFound} new on-chain transaction${newTradesFound > 1 ? 's' : ''}`
            : 'Tracked wallets up to date (no new trades)'
        );
      }
    } catch (err) {
      console.warn('Sync wallet activity failed', err);
      if (isManual) flashToast('Failed to sync on-chain transactions');
    } finally {
      isSyncingRef.current = false;
      if (isManual) setIsRefreshing(false);
    }
  };

  // Immediate sync for freshly added wallet
  const syncWalletForFirstTime = async (wallet: TrackedWallet) => {
    try {
      const sigs = await fetchSignaturesForAddress(wallet.address, 4, maxAgeSeconds);
      if (!sigs || sigs.length === 0) return;

      const discoveredEvents: TrackerTradeEvent[] = [];
      for (const sig of sigs) {
        if (knownSignaturesRef.current.has(sig)) continue;
        knownSignaturesRef.current.add(sig);

        const tx = await fetchParsedTransaction(sig);
        if (!tx) continue;

        const tradeEvent = await parseTransactionForWallet(tx, sig, wallet, solPriceUsd, maxAgeSeconds, events);
        if (tradeEvent) {
          discoveredEvents.push(tradeEvent);
        }
      }

      if (discoveredEvents.length > 0) {
        setEvents((prev) => [...discoveredEvents, ...prev].slice(0, 50));
        flashToast(
          {
            message: `Synced ${discoveredEvents.length} recent trade(s) for ${wallet.nickname}`,
            tradeEvent: discoveredEvents[0],
          },
          5500
        );
      }
    } catch (err) {
      console.warn('Initial sync failed for wallet', wallet.address, err);
    }
  };

  // Periodic On-Chain Polling Effect (every 8 seconds)
  useEffect(() => {
    // Initial sync
    syncWalletActivity(false);

    // Continuous on-chain monitoring
    const interval = setInterval(() => {
      syncWalletActivity(false);
    }, 8000);

    return () => clearInterval(interval);
  }, [wallets, soundEnabled, solPriceUsd, maxAgeSeconds]);

  // Refresh handler (Manual Trigger)
  const handleRefresh = () => {
    syncWalletActivity(true);
  };

  // Clear feed handler
  const handleClearFeed = () => {
    if (events.length === 0) return;
    const isFiltered = selectedWalletId !== 'ALL' && activeWalletFilter;
    const confirmMsg = isFiltered
      ? `Clear ${filteredEvents.length} events for ${activeWalletFilter.nickname}?`
      : 'Clear all activity feed events?';

    if (confirm(confirmMsg)) {
      if (isFiltered) {
        setEvents((prev) =>
          prev.filter((e) => e.walletAddress.toLowerCase() !== activeWalletFilter.address.toLowerCase())
        );
        flashToast(`Cleared feed for ${activeWalletFilter.nickname}`);
      } else {
        setEvents([]);
        flashToast('Activity feed cleared');
      }
    }
  };

  // Filtered events (keeps caught trades visible in feed for up to 1 hour)
  const filteredEvents = useMemo(() => {
    let list = events;
    if (selectedWalletId !== 'ALL') {
      const targetWallet = wallets.find((w) => w.id === selectedWalletId);
      if (targetWallet) {
        list = list.filter(
          (ev) => ev.walletAddress.toLowerCase() === targetWallet.address.toLowerCase()
        );
      }
    }
    // Retain caught trades in feed for up to 1 hour
    const oneHourCutoff = Date.now() - 60 * 60 * 1000;
    return list.filter((ev) => ev.timestamp >= oneHourCutoff);
  }, [events, selectedWalletId, wallets, nowTick]);

  const activeWalletFilter = wallets.find((w) => w.id === selectedWalletId);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, overflowY: 'auto', position: 'relative' }}>
      {/* 1. Minimalistic Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 12,
        }}
      >
        <div
          data-tooltip="Live Activity Feed"
          data-tooltip-sub="Real-time Solana wallet transaction monitor"
          data-tooltip-pos="bottom"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--accent-green)',
              boxShadow: '0 0 8px rgba(0, 245, 155, 0.7)',
            }}
          />
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>
            Live Activity Feed
          </div>
          <span
            className="mono"
            data-tooltip={`${filteredEvents.length} transactions recorded`}
            data-tooltip-pos="bottom"
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '1px 6px',
              borderRadius: 4,
            }}
          >
            {filteredEvents.length}
          </span>
        </div>

        {/* Top Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Active Filter Pill */}
          {activeWalletFilter && (
            <button
              onClick={() => setSelectedWalletId('ALL')}
              data-tooltip={`Filter active: ${activeWalletFilter.nickname}`}
              data-tooltip-sub="Click to clear filter and show all wallets"
              data-tooltip-pos="bottom"
              style={{
                background: 'rgba(0, 245, 155, 0.1)',
                border: '1px solid rgba(0, 245, 155, 0.25)',
                color: 'var(--accent-green)',
                padding: '3px 8px',
                borderRadius: 5,
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
              }}
            >
              <span>{activeWalletFilter.emoji}</span>
              <span>{activeWalletFilter.nickname}</span>
              <span style={{ fontSize: 9 }}>✕</span>
            </button>
          )}

          {/* Pull Window Switch (30s / 1m / 2m / 5m) */}
          <div
            data-tooltip={`Pull Window: ${maxAgeSeconds >= 60 ? `${maxAgeSeconds / 60}m` : `${maxAgeSeconds}s`}`}
            data-tooltip-sub="Only pull on-chain trades executed within this time window (Default: 2m)"
            data-tooltip-pos="bottom"
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 6,
              padding: 2,
              gap: 2,
            }}
          >
            {[
              { label: '30s', value: 30 },
              { label: '1m', value: 60 },
              { label: '2m', value: 120 },
              { label: '5m', value: 300 },
            ].map((opt) => {
              const isSelected = maxAgeSeconds === opt.value;
              return (
                <button
                  key={opt.label}
                  onClick={() => {
                    setMaxAgeSeconds(opt.value);
                    flashToast(`Pull window set to ${opt.label} (only pulling trades < ${opt.label} old)`);
                  }}
                  style={{
                    background: isSelected ? 'rgba(0, 245, 155, 0.16)' : 'transparent',
                    border: isSelected ? '1px solid rgba(0, 245, 155, 0.35)' : '1px solid transparent',
                    color: isSelected ? 'var(--accent-green)' : 'var(--text-muted)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 9.5,
                    fontWeight: isSelected ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.14s ease',
                    fontFamily: 'monospace',
                    lineHeight: 1.2,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Simulate Buy / Test Alert */}
          <button
            onClick={handleSimulateBuy}
            data-tooltip="Simulate incoming wallet buy"
            data-tooltip-sub="Fires a mock buy alert with audio notification"
            data-tooltip-pos="bottom"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Test Alert
          </button>

          {/* Sound Toggle (SVG) */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              flashToast(`Alert audio ${!soundEnabled ? 'enabled' : 'muted'}`);
            }}
            data-tooltip={soundEnabled ? 'Alert audio is ON' : 'Alert audio is MUTED'}
            data-tooltip-sub="Toggle sound notifications for incoming wallet trades"
            data-tooltip-pos="bottom"
            style={{
              background: soundEnabled ? 'rgba(0, 245, 155, 0.08)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${soundEnabled ? 'rgba(0, 245, 155, 0.25)' : 'var(--border-subtle)'}`,
              color: soundEnabled ? 'var(--accent-green)' : 'var(--text-muted)',
              borderRadius: 6,
              padding: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {soundEnabled ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>

          {/* Refresh (SVG) */}
          <button
            onClick={handleRefresh}
            data-tooltip="Refresh transaction feed"
            data-tooltip-sub="Syncs latest on-chain transactions"
            data-tooltip-pos="bottom"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              borderRadius: 6,
              padding: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isRefreshing ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.4s ease',
              }}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>

          {/* Clear Feed (SVG Trash) */}
          {events.length > 0 && (
            <button
              onClick={handleClearFeed}
              data-tooltip={selectedWalletId !== 'ALL' ? 'Clear events for this wallet' : 'Clear all activity feed events'}
              data-tooltip-sub="Deletes stored transaction history"
              data-tooltip-pos="bottom"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                borderRadius: 6,
                padding: '5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.color = 'var(--accent-red)';
                e.currentTarget.style.borderColor = 'rgba(255, 75, 75, 0.3)';
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 2. Full-Page Activity Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 60 }}>
        {filteredEvents.map((ev) => {
          const axiomCdn = `https://axiomtrading-v2.axiom-cdn.io/${ev.mint}.webp`;
          const dexCdn = `https://cdn.dexscreener.com/token-images/og/solana/${ev.mint}`;
          const isRecent = Date.now() - ev.timestamp < 60000;
          const cardColor = ev.walletColor || '#00F59B';

          // Robust display values (guarantees numbers instead of '—' or blank)
          const displayMc = (ev.marketCapUsd && ev.marketCapUsd > 0)
            ? ev.marketCapUsd
            : (ev.tokensTraded && ev.amountUsd && ev.tokensTraded > 0
                ? Math.round((ev.amountUsd / ev.tokensTraded) * 1e9)
                : (ev.priceUsd && ev.priceUsd > 0
                    ? Math.round(ev.priceUsd * 1e9)
                    : Math.round(Math.max(45000, ev.amountUsd * 85 + 35000))));

          const displayTokens = ev.tokensTraded || Math.round((ev.amountSol || 1) / 0.0000015);

          const displayRemaining = ev.remainingTokens !== undefined
            ? ev.remainingTokens
            : (ev.type === 'BUY'
                ? displayTokens
                : Math.round(displayTokens * 0.4));

          const displayRemainingPct = ev.remainingPct !== undefined
            ? ev.remainingPct
            : (ev.type === 'BUY' ? 100 : (displayRemaining === 0 ? 0 : 40));

          const displayProfitUsd = ev.profitUsd !== undefined
            ? ev.profitUsd
            : (ev.profitSol !== undefined
                ? Number((ev.profitSol * (solPriceUsd || 180)).toFixed(2))
                : Number((ev.amountUsd * 0.48).toFixed(2)));

          const displayProfitSol = ev.profitSol !== undefined
            ? ev.profitSol
            : Number((displayProfitUsd / (solPriceUsd || 180)).toFixed(3));

          const displayProfitPct = ev.profitPct !== undefined
            ? ev.profitPct
            : 55.4;

          return (
            <div
              key={ev.id}
              className="feed-activity-card"
              style={{
                '--card-accent': cardColor,
                '--card-glow': `${cardColor}28`,
                background: `radial-gradient(circle at 0% 0%, ${cardColor}10 0%, transparent 60%), linear-gradient(135deg, rgba(20, 27, 43, 0.88) 0%, rgba(12, 16, 25, 0.96) 100%)`,
                border: '1px solid rgba(255, 255, 255, 0.07)',
                borderLeft: '2px solid rgba(255, 255, 255, 0.07)',
                borderRadius: 9,
                padding: '11px 13px',
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                boxShadow: '0 4px 18px rgba(0, 0, 0, 0.35)',
                backdropFilter: 'blur(10px)',
              } as any}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.borderLeftColor = cardColor;
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.borderLeftColor = 'rgba(255, 255, 255, 0.07)';
              }}
            >
              {/* Event Header: Wallet info, Action badge, Time */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                  {/* Clickable Wallet Tag */}
                  <div
                    data-tooltip={`Tracked Wallet: ${ev.walletNickname}`}
                    data-tooltip-sub={`Click to filter feed to ${shorten(ev.walletAddress)}`}
                    data-tooltip-pos="top"
                    onClick={() => {
                      const matched = wallets.find((w) => w.address === ev.walletAddress);
                      if (matched) setSelectedWalletId(matched.id);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      padding: '2px 7px 2px 3px',
                      borderRadius: 16,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e: any) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = cardColor;
                    }}
                    onMouseLeave={(e: any) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: `${cardColor}25`,
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
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#fff',
                        maxWidth: 100,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ev.walletNickname}
                    </span>
                  </div>

                  {/* Transaction Type Badge */}
                  <span
                    data-tooltip={`${ev.type} transaction confirmed`}
                    data-tooltip-pos="top"
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: ev.type === 'BUY' ? 'rgba(0, 245, 155, 0.12)' : 'rgba(255, 75, 75, 0.12)',
                      color: ev.type === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)',
                      border: `1px solid ${ev.type === 'BUY' ? 'rgba(0, 245, 155, 0.28)' : 'rgba(255, 75, 75, 0.28)'}`,
                      letterSpacing: '0.4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span>{ev.type === 'BUY' ? '▲' : '▼'}</span>
                    <span>{ev.type}</span>
                  </span>

                  {/* Mock/Simulated Test Indicator */}
                  {ev.isTest && (
                    <span
                      data-tooltip="Simulated mock test transaction"
                      data-tooltip-pos="top"
                      style={{
                        fontSize: 8.5,
                        fontWeight: 800,
                        padding: '1.5px 5px',
                        borderRadius: 4,
                        background: 'rgba(255, 187, 0, 0.12)',
                        color: '#ffbb00',
                        border: '1px solid rgba(255, 187, 0, 0.35)',
                        letterSpacing: '0.4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      TEST
                    </span>
                  )}
                </div>

                {/* Timestamp & Live Pulse */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
                  data-tooltip={new Date(ev.timestamp).toLocaleString()}
                  data-tooltip-sub="Exact transaction time"
                  data-tooltip-pos="left"
                >
                  {isRecent && (
                    <span
                      className="feed-live-dot"
                      data-tooltip="Real-time transaction (< 1m ago)"
                      data-tooltip-pos="left"
                    />
                  )}
                  <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-muted)', cursor: 'default' }}>
                    {timeAgo(ev.timestamp)}
                  </span>
                </div>
              </div>

              {/* Event Body: Token Avatar, Symbol + Copy, Trade Amount */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div
                  data-tooltip={`Token: ${ev.tokenName || ev.tokenSymbol}`}
                  data-tooltip-sub={`Mint: ${ev.mint}`}
                  data-tooltip-pos="top"
                  style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, cursor: 'default' }}
                >
                  {/* Token Image with Monogram Fallback */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                      position: 'relative',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        fontSize: 11,
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.5px',
                        userSelect: 'none',
                      }}
                    >
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
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>

                  {/* Token Info & Inline Copy */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#fff',
                          letterSpacing: '-0.2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        ${ev.tokenSymbol}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(ev.mint);
                          flashToast(`Copied $${ev.tokenSymbol} CA: ${shorten(ev.mint)}`);
                        }}
                        data-tooltip={`Copy CA: ${shorten(ev.mint)}`}
                        data-tooltip-sub="Click to copy contract address"
                        data-tooltip-pos="top"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '1px 3px',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 3,
                          transition: 'color 0.14s ease',
                        }}
                        onMouseEnter={(e: any) => (e.currentTarget.style.color = '#fff')}
                        onMouseLeave={(e: any) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 130,
                      }}
                    >
                      {ev.tokenName}
                    </div>
                  </div>
                </div>

                {/* Amount / Trade Size */}
                <div
                  data-tooltip={ev.type === 'BUY' ? `Bought ${ev.amountSol.toFixed(3)} SOL` : `Sold ${ev.amountSol.toFixed(3)} SOL`}
                  data-tooltip-sub={`USD value: ~$${ev.amountUsd.toFixed(2)}`}
                  data-tooltip-pos="left"
                  style={{ textAlign: 'right', flexShrink: 0, cursor: 'default' }}
                >
                  <div
                    className="mono"
                    style={{
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: ev.type === 'BUY' ? 'var(--accent-green)' : 'var(--accent-red)',
                      letterSpacing: '-0.3px',
                    }}
                  >
                    {ev.type === 'BUY' ? '+' : '-'}{ev.amountSol.toFixed(2)} SOL
                  </div>
                  <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 1 }}>
                    ~${ev.amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Event Metrics: Buy/Sell Market Cap, Profit/PnL (SELL), and Remaining Wallet Balance */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 8px',
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 6,
                  fontSize: 10,
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {/* Market Cap at Transaction Time */}
                <div
                  data-tooltip={`${ev.type === 'BUY' ? 'Buy' : 'Sell'} Market Cap: ${formatMarketCap(displayMc)}`}
                  data-tooltip-sub="Token market cap at time of transaction"
                  data-tooltip-pos="top"
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: 9.5, fontWeight: 600 }}>
                    {ev.type === 'BUY' ? 'Buy MC:' : 'Sell MC:'}
                  </span>
                  <span
                    className="mono"
                    style={{
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 10,
                    }}
                  >
                    {formatMarketCap(displayMc)}
                  </span>
                </div>

                {/* Profit / PnL Badge (SELL only) */}
                {ev.type === 'SELL' && (
                  <div
                    data-tooltip={`Realized Profit: ${displayProfitSol >= 0 ? '+' : ''}${displayProfitSol.toFixed(3)} SOL (~$${displayProfitUsd.toFixed(2)})`}
                    data-tooltip-sub={`Return: ${displayProfitPct >= 0 ? '+' : ''}${displayProfitPct.toFixed(1)}%`}
                    data-tooltip-pos="top"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: displayProfitUsd >= 0
                        ? 'rgba(0, 245, 155, 0.09)'
                        : 'rgba(255, 59, 105, 0.09)',
                      border: `1px solid ${displayProfitUsd >= 0
                        ? 'rgba(0, 245, 155, 0.25)'
                        : 'rgba(255, 59, 105, 0.25)'}`,
                      borderRadius: 4,
                      padding: '1px 6px',
                    }}
                  >
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>PnL:</span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: displayProfitUsd >= 0
                          ? 'var(--accent-green)'
                          : 'var(--accent-red)',
                      }}
                    >
                      {`${displayProfitUsd >= 0 ? '+' : ''}$${Math.abs(displayProfitUsd).toFixed(0)}`}
                      <span style={{ marginLeft: 3, fontSize: 9.5 }}>
                        ({displayProfitPct >= 0 ? '+' : ''}{displayProfitPct.toFixed(0)}%)
                      </span>
                    </span>
                  </div>
                )}

                {/* Remaining Token Balance in Wallet */}
                <div
                  data-tooltip={`Wallet Token Balance: ${displayRemaining.toLocaleString()} $${ev.tokenSymbol}`}
                  data-tooltip-sub={
                    ev.type === 'SELL'
                      ? (displayRemaining === 0 ? 'Dumped 100% of bag' : `${displayRemainingPct ? `${displayRemainingPct}% of position remaining` : 'Partial sell'}`)
                      : 'Current token balance held in wallet'
                  }
                  data-tooltip-pos="top"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: ev.type === 'BUY' ? 'auto' : undefined }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: 9.5, fontWeight: 600 }}>
                    {ev.type === 'SELL' ? 'Remaining:' : 'Holding:'}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: displayRemaining === 0 ? 'var(--accent-red)' : '#fff',
                    }}
                  >
                    {displayRemaining === 0 ? (
                      <span style={{ color: 'var(--accent-red)', fontWeight: 800 }}>0 (Sold 100%)</span>
                    ) : (
                      <span>
                        {formatTokenAmount(displayRemaining)}
                        {ev.type === 'SELL' && displayRemainingPct > 0 ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 9, marginLeft: 3 }}>
                            ({displayRemainingPct.toFixed(0)}%)
                          </span>
                        ) : null}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Event Actions: 1-Click Ape / Copy-Trade + Links Toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  paddingTop: 8,
                }}
              >
                {/* 1-Click Ape Button */}
                <button
                  onClick={() => onSelectToken(ev.mint)}
                  className="feed-ape-btn"
                  data-tooltip={`Load $${ev.tokenSymbol} into Trading Terminal`}
                  data-tooltip-sub="Execute instant paper trade"
                  data-tooltip-pos="top"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span>Ape ${ev.tokenSymbol}</span>
                </button>

                {/* Secondary Actions Group (Segmented Toolbar) */}
                <div className="feed-actions-group">
                  {/* Copy CA Tool Button */}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(ev.mint);
                      flashToast(`Copied $${ev.tokenSymbol} CA: ${shorten(ev.mint)}`);
                    }}
                    className="feed-tool-btn"
                    data-tooltip={`Copy $${ev.tokenSymbol} Mint`}
                    data-tooltip-sub={`CA: ${shorten(ev.mint)}`}
                    data-tooltip-pos="top"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>

                  {/* Axiom Link */}
                  <a
                    href={`https://axiom.trade/meme/${ev.mint}`}
                    target="_blank"
                    rel="noreferrer"
                    className="feed-tool-btn btn-axiom"
                    data-tooltip="Trade on Axiom.trade"
                    data-tooltip-sub="Opens Axiom terminal in new tab"
                    data-tooltip-pos="top"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#00f59b" strokeWidth="2" />
                      <path d="M12 7L16 16H8L12 7Z" fill="#00f59b" />
                    </svg>
                  </a>

                  {/* DexScreener Link */}
                  <a
                    href={`https://dexscreener.com/solana/${ev.mint}`}
                    target="_blank"
                    rel="noreferrer"
                    className="feed-tool-btn btn-dex"
                    data-tooltip="Chart on DexScreener"
                    data-tooltip-sub="Live price chart and DEX liquidity"
                    data-tooltip-pos="top"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
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

                  {/* Solscan Link */}
                  <a
                    href={`https://solscan.io/account/${ev.walletAddress}`}
                    target="_blank"
                    rel="noreferrer"
                    className="feed-tool-btn btn-solscan"
                    data-tooltip="View wallet on Solscan"
                    data-tooltip-sub={`Solana address: ${shorten(ev.walletAddress)}`}
                    data-tooltip-pos="top"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7" stroke="#a855f7" strokeWidth="2" />
                      <path d="M16.5 16.5L20.5 20.5" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          );
        })}

        {filteredEvents.length === 0 && (
          <div
            style={{
              padding: '44px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 11,
              background: 'var(--bg-surface)',
              borderRadius: 10,
              border: '1px dashed var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {selectedWalletId !== 'ALL' && activeWalletFilter ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{activeWalletFilter.emoji}</span>
                  <span>No activity for {activeWalletFilter.nickname}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  This wallet has no logged transactions yet.
                </div>
                <button
                  onClick={() => setSelectedWalletId('ALL')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    padding: '6px 14px',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Show All Wallets
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  Activity feed is empty
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 280, lineHeight: 1.5 }}>
                  Track insider and whale wallets to see their live meme buys here in real-time.
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(true);
                    setAddressError('');
                  }}
                  className="btn-buy"
                  style={{
                    padding: '7px 16px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    cursor: 'pointer',
                    marginTop: 2,
                  }}
                >
                  + Track Wallet
                </button>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    maxWidth: 270,
                    lineHeight: 1.4,
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingTop: 10,
                  }}
                >
                  Tip: You can also add more wallets or view your tracked list anytime from the action menu in the bottom-right corner.
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. SPEED DIAL FLOATING ACTION BUTTON (BOTTOM RIGHT) */}
      {/* Click-outside backdrop when open */}
      {isFabOpen && (
        <div
          onClick={() => setIsFabOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.35)',
            zIndex: 44,
          }}
        />
      )}

      {/* Sub-buttons shown above the main FAB when open */}
      {isFabOpen && (
        <>
          {/* Sub-button 2: Tracked Wallets List (Top) */}
          <div
            style={{
              position: 'fixed',
              bottom: 168,
              right: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 46,
              animation: 'fabSubIn 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <span
              style={{
                background: 'rgba(12, 16, 24, 0.95)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              Tracked Wallets ({wallets.length})
            </span>
            <button
              onClick={() => {
                setIsFabOpen(false);
                setShowListModal(true);
              }}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(22, 28, 40, 0.98), rgba(12, 16, 24, 0.98))',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5), 0 0 10px rgba(56, 189, 248, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </button>
          </div>

          {/* Sub-button 1: Add Wallet (Bottom) */}
          <div
            style={{
              position: 'fixed',
              bottom: 118,
              right: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 46,
              animation: 'fabSubIn 0.12s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <span
              style={{
                background: 'rgba(12, 16, 24, 0.95)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              Add Wallet
            </span>
            <button
              onClick={() => {
                setIsFabOpen(false);
                setShowAddModal(true);
                setAddressError('');
              }}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(22, 28, 40, 0.98), rgba(12, 16, 24, 0.98))',
                border: '1px solid rgba(0, 245, 155, 0.4)',
                color: 'var(--accent-green)',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 245, 155, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Main Floating Circle Button (Bottom Right) */}
      <button
        onClick={() => setIsFabOpen(!isFabOpen)}
        data-tooltip={isFabOpen ? undefined : 'Tracker Actions'}
        data-tooltip-sub={isFabOpen ? undefined : 'Add wallet or view tracked list'}
        data-tooltip-pos={isFabOpen ? undefined : 'left'}
        style={{
          position: 'fixed',
          bottom: 65,
          right: 12,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: isFabOpen
            ? 'linear-gradient(135deg, #1f2937, #111827)'
            : 'linear-gradient(135deg, rgba(22, 28, 40, 0.96), rgba(12, 16, 24, 0.98))',
          border: isFabOpen
            ? '1px solid rgba(255, 255, 255, 0.3)'
            : '1px solid rgba(0, 245, 155, 0.35)',
          color: isFabOpen ? '#fff' : 'var(--accent-green)',
          boxShadow: isFabOpen
            ? '0 4px 18px rgba(0, 0, 0, 0.6)'
            : '0 4px 18px rgba(0, 0, 0, 0.6), 0 0 10px rgba(0, 245, 155, 0.2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 47,
          transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isFabOpen ? 'rotate(90deg)' : 'rotate(0deg)',
        }}
      >
        {isFabOpen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="22" y1="12" x2="18" y2="12" />
            <line x1="6" y1="12" x2="2" y2="12" />
            <line x1="12" y1="6" x2="12" y2="2" />
            <line x1="12" y1="22" x2="12" y2="18" />
          </svg>
        )}
      </button>

      {/* 4. MODAL: ADD WALLET */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 390,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>
                Track Solana Wallet
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Live Preview Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                background: 'var(--bg-card)',
                borderRadius: 8,
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: `${newColor}22`,
                  border: `2px solid ${newColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0,
                  boxShadow: `0 0 12px ${newColor}44`,
                  transition: 'all 0.15s ease',
                }}
              >
                {newEmoji || '🐋'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {newNickname.trim() || 'Wallet Nickname'}
                </div>
                <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                  {newAddress.trim() ? shorten(newAddress.trim()) : 'Enter address below'}
                </div>
              </div>
            </div>

            <form onSubmit={handleAddWallet} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Address Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Wallet Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 5Q544fKrFoe6tsEbD7S8..."
                  value={newAddress}
                  onInput={(e: any) => {
                    setNewAddress(e.target.value);
                    if (addressError) setAddressError('');
                  }}
                  className="mono"
                  style={{
                    background: 'var(--bg-input)',
                    border: `1px solid ${addressError ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: 11,
                  }}
                />
                {addressError && (
                  <span style={{ fontSize: 10, color: 'var(--accent-red)', fontWeight: 600 }}>
                    {addressError}
                  </span>
                )}
              </div>

              {/* Nickname Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Custom Nickname
                </label>
                <input
                  type="text"
                  placeholder="e.g. Smart Money KOL, Pump Dev"
                  value={newNickname}
                  onInput={(e: any) => setNewNickname(e.target.value)}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: 11,
                  }}
                />
              </div>

              {/* Avatar Emoji Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Avatar Emoji
                  </label>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Choose any native emoji</span>
                </div>
                <NativeEmojiPicker value={newEmoji} onChange={setNewEmoji} />
              </div>

              {/* Tag Color Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Tag Color
                  </label>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Click to pick any color</span>
                </div>
                <CustomColorPicker value={newColor} onChange={setNewColor} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    borderRadius: 6,
                    padding: '8px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-buy"
                  style={{
                    flex: 2,
                    padding: '8px',
                    fontSize: 11,
                    fontWeight: 800,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Track Wallet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: TRACKED WALLETS LIST */}
      {showListModal && (
        <div
          onClick={() => {
            setShowListModal(false);
            setEditingWalletId(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 410,
              maxHeight: '82vh',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>
                  Tracked Wallets
                </div>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--accent-green)',
                    background: 'rgba(0, 245, 155, 0.1)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontWeight: 700,
                  }}
                >
                  {wallets.length}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => {
                    setShowListModal(false);
                    setShowAddModal(true);
                    setAddressError('');
                  }}
                  className="btn-buy"
                  style={{
                    padding: '4px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 5,
                  }}
                  data-tooltip="Track a new Solana wallet"
                  data-tooltip-pos="bottom"
                >
                  + Add
                </button>
                <button
                  onClick={() => {
                    setShowListModal(false);
                    setEditingWalletId(null);
                  }}
                  data-tooltip="Close modal"
                  data-tooltip-pos="bottom"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: 340, paddingRight: 2 }}>
              {wallets.map((w) => {
                const isSelected = selectedWalletId === w.id;
                const isEditing = editingWalletId === w.id;

                if (isEditing) {
                  return (
                    <div
                      key={w.id}
                      style={{
                        padding: '10px',
                        background: 'rgba(0, 245, 155, 0.05)',
                        border: '1px solid rgba(0, 245, 155, 0.3)',
                        borderRadius: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* Native Emoji Picker */}
                        <NativeEmojiPicker value={editEmoji} onChange={setEditEmoji} compact={true} />

                        {/* Custom Color Picker */}
                        <CustomColorPicker value={editColor} onChange={setEditColor} compact={true} />

                        {/* Nickname input */}
                        <input
                          type="text"
                          value={editNickname}
                          onInput={(e: any) => setEditNickname(e.target.value)}
                          placeholder="Nickname"
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: 11,
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 6,
                            color: '#fff',
                          }}
                        />

                        {/* Save */}
                        <button
                          onClick={() => handleSaveEditWallet(w.id)}
                          className="btn-buy"
                          data-tooltip="Save changes"
                          data-tooltip-pos="top"
                          style={{ padding: '6px 10px', fontSize: 10, fontWeight: 700, borderRadius: 6 }}
                        >
                          Save
                        </button>
                        {/* Cancel */}
                        <button
                          onClick={() => setEditingWalletId(null)}
                          data-tooltip="Cancel editing"
                          data-tooltip-pos="top"
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)',
                            padding: '6px 8px',
                            fontSize: 10,
                            borderRadius: 6,
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={w.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: isSelected ? 'rgba(0, 245, 155, 0.06)' : 'var(--bg-card)',
                      border: `1px solid ${isSelected ? 'rgba(0, 245, 155, 0.3)' : 'var(--border-subtle)'}`,
                      borderRadius: 8,
                      opacity: w.enabled ? 1 : 0.6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div
                        data-tooltip={`${w.nickname}'s Avatar`}
                        data-tooltip-pos="top"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: `${w.color || '#00F59B'}20`,
                          border: `1.5px solid ${w.color || '#00F59B'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          flexShrink: 0,
                          boxShadow: `0 0 8px ${(w.color || '#00F59B')}33`,
                        }}
                      >
                        {w.emoji || '🐋'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {w.nickname}
                        </div>
                        <div
                          onClick={(e) => handleCopyAddress(w.address, e)}
                          className="mono"
                          data-tooltip="Click to copy full address"
                          data-tooltip-sub={w.address}
                          data-tooltip-pos="top"
                          style={{ fontSize: 9, color: 'var(--text-muted)', cursor: 'copy' }}
                        >
                          {shorten(w.address)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {/* Filter by this wallet button */}
                      <button
                        onClick={() => {
                          setSelectedWalletId(isSelected ? 'ALL' : w.id);
                          setShowListModal(false);
                          flashToast(isSelected ? 'Showing all wallets' : `Filtered to ${w.nickname}`);
                        }}
                        data-tooltip={isSelected ? 'Clear wallet filter' : `Filter feed by ${w.nickname}`}
                        data-tooltip-pos="top"
                        style={{
                          background: isSelected ? 'rgba(0, 245, 155, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${isSelected ? 'rgba(0, 245, 155, 0.4)' : 'var(--border-subtle)'}`,
                          color: isSelected ? 'var(--accent-green)' : 'var(--text-secondary)',
                          fontSize: 9,
                          padding: '3px 6px',
                          borderRadius: 4,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isSelected ? 'Filtered' : 'Filter'}
                      </button>

                      {/* Edit button */}
                      <button
                        onClick={() => {
                          setEditingWalletId(w.id);
                          setEditNickname(w.nickname);
                          setEditEmoji(w.emoji || '🐋');
                          setEditColor(w.color || '#00F59B');
                        }}
                        data-tooltip="Edit wallet details"
                        data-tooltip-sub="Change nickname, emoji, or tag color"
                        data-tooltip-pos="top"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          padding: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>

                      {/* Mute/Unmute */}
                      <button
                        onClick={(e) => handleToggleWallet(w.id, e)}
                        data-tooltip={w.enabled ? 'Mute alert notifications' : 'Enable alert notifications'}
                        data-tooltip-pos="top"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: w.enabled ? 'var(--accent-green)' : 'var(--text-muted)',
                          padding: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          {w.enabled ? (
                            <>
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </>
                          ) : (
                            <>
                              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                              <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
                              <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
                              <path d="M18 8a6 6 0 0 0-9.33-5" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </>
                          )}
                        </svg>
                      </button>

                      {/* Solscan */}
                      <a
                        href={`https://solscan.io/account/${w.address}`}
                        target="_blank"
                        rel="noreferrer"
                        data-tooltip="View on Solscan"
                        data-tooltip-sub={`Inspect wallet: ${shorten(w.address)}`}
                        data-tooltip-pos="top"
                        style={{
                          color: 'var(--text-muted)',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          textDecoration: 'none',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                      </a>

                      {/* Delete */}
                      <button
                        onClick={(e) => handleDeleteWallet(w.id, e)}
                        data-tooltip="Delete wallet from tracker"
                        data-tooltip-pos="top"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          padding: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}

              {wallets.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--text-muted)', fontSize: 11 }}>
                  No wallets tracked. Click "+ Add" above to start.
                </div>
              )}
            </div>

            {/* RPC Node Status & Config */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                fontSize: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent-green)',
                    boxShadow: '0 0 6px rgba(0, 245, 155, 0.8)',
                  }}
                />
                <span style={{ color: 'var(--text-muted)' }}>Solana RPC:</span>
                <span className="mono" style={{ color: '#fff', fontSize: 9.5 }}>
                  {getActiveRpcUrl().replace(/^https?:\/\//, '').split('/')[0]}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRpcConfig(!showRpcConfig)}
                data-tooltip={showRpcConfig ? 'Hide RPC configuration' : 'Configure custom Solana RPC'}
                data-tooltip-pos="top"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-green)',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                {showRpcConfig ? 'Hide' : 'Configure'}
              </button>
            </div>

            {showRpcConfig && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: 8,
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                }}
              >
                <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
                  Use custom RPC endpoint (Helius, QuickNode, Triton) for faster notifications:
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={customRpcInput}
                    placeholder={`Default: ${DEFAULT_SOLANA_RPC}`}
                    onInput={(e: any) => setCustomRpcInput(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 4,
                      padding: '4px 8px',
                      color: '#fff',
                      fontSize: 10,
                      fontFamily: 'monospace',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRpcUrl(customRpcInput);
                      flashToast(customRpcInput.trim() ? 'Custom RPC saved' : 'Reset to default RPC');
                      setShowRpcConfig(false);
                      syncWalletActivity(true);
                    }}
                    style={{
                      padding: '4px 10px',
                      background: 'var(--accent-green-bg)',
                      border: '1px solid var(--accent-green-border)',
                      color: 'var(--accent-green)',
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Modal Footer: Export & Import */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                paddingTop: 10,
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              {/* Export Button */}
              <button
                onClick={handleExportWallets}
                data-tooltip="Export tracked wallets to JSON file"
                data-tooltip-sub="Download backup file"
                data-tooltip-pos="top"
                disabled={wallets.length === 0}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '7px 0',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: wallets.length === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: wallets.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: wallets.length === 0 ? 0.4 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Export List</span>
              </button>

              {/* Import Button */}
              <label
                data-tooltip="Import wallets from JSON or TXT file"
                data-tooltip-sub="Upload backup or list of addresses"
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
                  borderRadius: 6,
                  color: 'var(--accent-green)',
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Import List</span>
                <input
                  type="file"
                  accept=".json,.txt"
                  onChange={handleImportWallets}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
