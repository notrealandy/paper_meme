/**
 * Global Sleek Tooltip System for Paper Meme
 * 
 * Features:
 * - Single fixed DOM singleton attached to <body> (zero clipping by overflow: hidden)
 * - Auto-detects [data-tooltip] and automatically intercepts [title] to eliminate OS default tooltips
 * - Snappy 120ms initial hover delay with 0ms warm-handoff when moving between elements
 * - Viewport boundary clamping & smart flipping (top/bottom/left/right)
 * - Responsive pointer-events: none, auto-dismiss on click, scroll, blur, or Escape
 * - Support for titles, subtexts, and hotkey badges
 */

import { cloneElement, isValidElement, type ComponentChildren } from 'preact';

let tooltipEl: HTMLDivElement | null = null;
let arrowEl: HTMLDivElement | null = null;
let titleEl: HTMLSpanElement | null = null;
let hotkeyEl: HTMLSpanElement | null = null;
let subEl: HTMLDivElement | null = null;

let activeTarget: HTMLElement | null = null;
let showTimer: number | null = null;
let lastHideTime = 0;
let isInitialized = false;

function getOrCreateTooltip(): HTMLDivElement {
  if (tooltipEl && document.body.contains(tooltipEl)) {
    return tooltipEl;
  }

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'paper-tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('aria-hidden', 'true');

  const header = document.createElement('div');
  header.className = 'paper-tooltip-header';

  titleEl = document.createElement('span');
  titleEl.className = 'paper-tooltip-title';

  hotkeyEl = document.createElement('span');
  hotkeyEl.className = 'paper-tooltip-hotkey';
  hotkeyEl.style.display = 'none';

  header.appendChild(titleEl);
  header.appendChild(hotkeyEl);

  subEl = document.createElement('div');
  subEl.className = 'paper-tooltip-sub';
  subEl.style.display = 'none';

  arrowEl = document.createElement('div');
  arrowEl.className = 'paper-tooltip-arrow';

  tooltipEl.appendChild(header);
  tooltipEl.appendChild(subEl);
  tooltipEl.appendChild(arrowEl);

  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

export function hideTooltip() {
  if (showTimer !== null) {
    window.clearTimeout(showTimer);
    showTimer = null;
  }
  if (tooltipEl && tooltipEl.classList.contains('paper-tooltip-visible')) {
    tooltipEl.classList.remove('paper-tooltip-visible');
    lastHideTime = Date.now();
  }
  activeTarget = null;
}

export function showTooltipForTarget(target: HTMLElement) {
  const tooltip = getOrCreateTooltip();

  // Extract content
  let text = target.getAttribute('data-tooltip') || '';
  if (!text && target.hasAttribute('title')) {
    const rawTitle = target.getAttribute('title') || '';
    if (rawTitle) {
      text = rawTitle;
      target.setAttribute('data-original-title', rawTitle);
      target.setAttribute('data-tooltip', rawTitle);
      target.removeAttribute('title');
    }
  }

  if (!text) {
    hideTooltip();
    return;
  }

  const sub = target.getAttribute('data-tooltip-sub') || '';
  const hotkey = target.getAttribute('data-tooltip-hotkey') || '';
  const preferredPos = (target.getAttribute('data-tooltip-pos') || 'top') as 'top' | 'bottom' | 'left' | 'right';

  if (titleEl) titleEl.textContent = text;

  if (hotkeyEl) {
    if (hotkey) {
      hotkeyEl.textContent = hotkey;
      hotkeyEl.style.display = 'inline-block';
    } else {
      hotkeyEl.style.display = 'none';
    }
  }

  if (subEl) {
    if (sub) {
      subEl.textContent = sub;
      subEl.style.display = 'block';
    } else {
      subEl.style.display = 'none';
    }
  }

  // Position calculation
  const targetRect = target.getBoundingClientRect();
  if (targetRect.width === 0 && targetRect.height === 0) {
    hideTooltip();
    return;
  }

  // Pre-measure tooltip
  tooltip.style.visibility = 'hidden';
  tooltip.style.display = 'flex';
  tooltip.style.left = '0px';
  tooltip.style.top = '0px';
  const tipWidth = tooltip.offsetWidth || 120;
  const tipHeight = tooltip.offsetHeight || 26;
  tooltip.style.visibility = '';

  let pos = preferredPos;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Smart flipping
  if (pos === 'top' && targetRect.top - tipHeight - 7 < 0) {
    pos = 'bottom';
  } else if (pos === 'bottom' && targetRect.bottom + tipHeight + 7 > viewportHeight) {
    pos = 'top';
  } else if (pos === 'left' && targetRect.left - tipWidth - 7 < 0) {
    pos = 'right';
  } else if (pos === 'right' && targetRect.right + tipWidth + 7 > viewportWidth) {
    pos = 'left';
  }

  let left = 0;
  let top = 0;

  if (pos === 'top') {
    top = targetRect.top - tipHeight - 6;
    left = targetRect.left + (targetRect.width - tipWidth) / 2;
  } else if (pos === 'bottom') {
    top = targetRect.bottom + 6;
    left = targetRect.left + (targetRect.width - tipWidth) / 2;
  } else if (pos === 'left') {
    left = targetRect.left - tipWidth - 6;
    top = targetRect.top + (targetRect.height - tipHeight) / 2;
  } else {
    // right
    left = targetRect.right + 6;
    top = targetRect.top + (targetRect.height - tipHeight) / 2;
  }

  // Screen bounds clamping
  const clampedLeft = Math.max(8, Math.min(left, viewportWidth - tipWidth - 8));
  const clampedTop = Math.max(6, Math.min(top, viewportHeight - tipHeight - 6));

  // Align arrow directly towards target center
  if (arrowEl) {
    if (pos === 'top' || pos === 'bottom') {
      const targetCenter = targetRect.left + targetRect.width / 2;
      let arrowLeft = targetCenter - clampedLeft;
      arrowLeft = Math.max(10, Math.min(arrowLeft, tipWidth - 10));
      arrowEl.style.left = `${arrowLeft}px`;
      arrowEl.style.top = '';
    } else {
      const targetCenter = targetRect.top + targetRect.height / 2;
      let arrowTop = targetCenter - clampedTop;
      arrowTop = Math.max(8, Math.min(arrowTop, tipHeight - 8));
      arrowEl.style.top = `${arrowTop}px`;
      arrowEl.style.left = '';
    }
  }

  tooltip.setAttribute('data-pos', pos);
  tooltip.style.left = `${Math.round(clampedLeft)}px`;
  tooltip.style.top = `${Math.round(clampedTop)}px`;
  tooltip.classList.add('paper-tooltip-visible');
  activeTarget = target;
}

function handlePointerOver(e: PointerEvent) {
  const rawTarget = e.target as HTMLElement | null;
  if (!rawTarget) return;

  const target = rawTarget.closest('[data-tooltip], [title]') as HTMLElement | null;
  if (!target) return;

  // Intercept native title to prevent ugly browser tooltip
  if (target.hasAttribute('title')) {
    const rawTitle = target.getAttribute('title') || '';
    if (rawTitle) {
      target.setAttribute('data-original-title', rawTitle);
      target.setAttribute('data-tooltip', rawTitle);
      target.removeAttribute('title');
    }
  }

  if (!target.getAttribute('data-tooltip')) return;

  if (activeTarget === target) return;

  if (showTimer !== null) {
    window.clearTimeout(showTimer);
    showTimer = null;
  }

  // Snappy warm delay (0ms if recently shown) or 120ms normal delay
  const isWarm = Date.now() - lastHideTime < 350;
  const delay = isWarm ? 0 : 120;

  if (delay === 0) {
    showTooltipForTarget(target);
  } else {
    showTimer = window.setTimeout(() => {
      showTimer = null;
      showTooltipForTarget(target);
    }, delay);
  }
}

function handlePointerOut(e: PointerEvent) {
  const rawTarget = e.target as HTMLElement | null;
  if (!rawTarget) return;

  const target = rawTarget.closest('[data-tooltip], [data-original-title]') as HTMLElement | null;
  if (!target) return;

  const related = e.relatedTarget as HTMLElement | null;
  if (related && target.contains(related)) {
    return; // Still within the element
  }

  hideTooltip();
}

export function initTooltips() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  document.addEventListener('pointerover', handlePointerOver, { passive: true });
  document.addEventListener('pointerout', handlePointerOut, { passive: true });
  document.addEventListener('pointerdown', hideTooltip, { passive: true });
  window.addEventListener('scroll', hideTooltip, { passive: true, capture: true });
  window.addEventListener('blur', hideTooltip, { passive: true });
  window.addEventListener('resize', hideTooltip, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTooltip();
  }, { passive: true });
}

export interface TooltipProps {
  content: string;
  sub?: string;
  hotkey?: string;
  pos?: 'top' | 'bottom' | 'left' | 'right';
  children: ComponentChildren;
  style?: Record<string, any>;
  className?: string;
}

/**
 * JSX Component wrapper for Tooltips
 */
export function Tooltip({ content, sub, hotkey, pos = 'top', children, style, className }: TooltipProps) {
  if (isValidElement(children)) {
    return cloneElement(children as any, {
      'data-tooltip': content,
      ...(sub ? { 'data-tooltip-sub': sub } : {}),
      ...(hotkey ? { 'data-tooltip-hotkey': hotkey } : {}),
      ...(pos ? { 'data-tooltip-pos': pos } : {}),
    });
  }

  return (
    <span
      data-tooltip={content}
      data-tooltip-sub={sub}
      data-tooltip-hotkey={hotkey}
      data-tooltip-pos={pos}
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', ...style }}
    >
      {children}
    </span>
  );
}
