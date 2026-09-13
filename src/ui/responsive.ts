/**
 * Emergency Mesh Nürnberg — Responsive UI & OLED Layout Engine
 * Adheres strictly to FytlY architectural guardrails:
 * - Dynamic scaling via base viewport ratios
 * - Zero raw uncalculated numeric dimensions
 * - Battery-conserving OLED dark palette for blackout survival
 */

// Base design reference: 390x844 (Standard modern mobile device)
export const BASE_WIDTH = 390;
export const BASE_HEIGHT = 844;

/**
 * Calculates responsive width percentage from target pixel value.
 */
export function respWidth(px: number, windowWidth = 390): number {
  return Math.round((px / BASE_WIDTH) * windowWidth);
}

/**
 * Calculates responsive height percentage from target pixel value.
 */
export function respHeight(px: number, windowHeight = 844): number {
  return Math.round((px / BASE_HEIGHT) * windowHeight);
}

/**
 * Calculates responsive font size scaled proportionally with accessibility limits.
 */
export function respFontSize(size: number, windowWidth = 390): number {
  const scale = windowWidth / BASE_WIDTH;
  const newSize = size * scale;
  // Bounded between 80% and 130% of base size to prevent clipping
  return Math.round(Math.min(Math.max(newSize, size * 0.8), size * 1.3));
}

/**
 * OLED High-Contrast Katastrophenschutz Color Palette
 * Designed for minimum milliampere battery draw during grid collapse.
 */
export const OLED_PALETTE = {
  // Pure Black Background (Pixels powered off on OLED)
  background: '#000000',
  surfaceCard: '#0a0a0a',
  surfaceBorder: '#1c1c1c',
  surfaceBorderActive: '#333333',

  // Signal Accents
  sosRed: '#ff2a2a',
  sosRedGlow: 'rgba(255, 42, 42, 0.25)',
  safeGreen: '#00e676',
  safeGreenGlow: 'rgba(0, 230, 118, 0.2)',
  warningAmber: '#ffb300',
  meshCyan: '#00e5ff',

  // Text Hierarchy
  textPrimary: '#ffffff',
  textSecondary: '#a0a0a0',
  textMuted: '#666666',
  textInverse: '#000000'
} as const;
