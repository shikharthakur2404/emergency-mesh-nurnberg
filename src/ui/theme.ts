/**
 * Emergency Mesh Nürnberg — Dual Theme System
 * Supports:
 * - 'civic': Calm German civic public infrastructure design inspired by DB Navigator & NINA Warn-App
 * - 'tactical': Cockpit / Katastrophenschutz high-contrast OLED monospace terminal
 */

import { FONTS } from './typography';

export type ThemeMode = 'civic' | 'tactical';

export interface ThemeColors {
  mode: ThemeMode;
  background: string;
  surfaceCard: string;
  surfaceCardMuted: string;
  surfaceBorder: string;
  surfaceBorderActive: string;
  headerBackground: string;

  // Accents
  sosRed: string;
  sosRedGlow: string;
  safeGreen: string;
  safeGreenGlow: string;
  warningAmber: string;
  accentBlue: string;

  // Civic / Franconian
  nurnbergRed: string;
  imperialGold: string;
  sinwellSlate: string;
  kaiserburgCard: string;
  franconianWhite: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Layout tokens
  cardRadius: number;
  badgeRadius: number;
  cardBorderWidth: number;
  letterSpacingTactical: number;

  // Typography font families
  fontTitle: string;
  fontBody: string;
  fontMono: string;
}

export const THEME_CIVIC: ThemeColors = {
  mode: 'civic',
  background: '#11141a',
  surfaceCard: '#161e2e',
  surfaceCardMuted: '#1c2538',
  surfaceBorder: '#253248',
  surfaceBorderActive: '#3b82f6',
  headerBackground: '#11141a',

  sosRed: '#e11d48',
  sosRedGlow: 'rgba(225, 29, 72, 0.25)',
  safeGreen: '#10b981',
  safeGreenGlow: 'rgba(16, 185, 129, 0.2)',
  warningAmber: '#f59e0b',
  accentBlue: '#38bdf8',

  nurnbergRed: '#e11d48',
  imperialGold: '#f59e0b',
  sinwellSlate: '#182234',
  kaiserburgCard: '#161e2e',
  franconianWhite: '#f8fafc',

  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  textInverse: '#0f172a',

  cardRadius: 14,
  badgeRadius: 9999,
  cardBorderWidth: 1,
  letterSpacingTactical: 0,

  fontTitle: FONTS.displayBold || 'System',
  fontBody: FONTS.displayRegular || 'System',
  fontMono: FONTS.monoRegular || 'monospace',
};

export const THEME_TACTICAL: ThemeColors = {
  mode: 'tactical',
  background: '#000000',
  surfaceCard: '#0a0a0a',
  surfaceCardMuted: '#141414',
  surfaceBorder: '#1c1c1c',
  surfaceBorderActive: '#333333',
  headerBackground: '#000000',

  sosRed: '#d90429',
  sosRedGlow: 'rgba(217, 4, 41, 0.25)',
  safeGreen: '#00e676',
  safeGreenGlow: 'rgba(0, 230, 118, 0.2)',
  warningAmber: '#ffb300',
  accentBlue: '#38bdf8',

  nurnbergRed: '#d90429',
  imperialGold: '#ffb703',
  sinwellSlate: '#0f172a',
  kaiserburgCard: '#070b12',
  franconianWhite: '#f8f9fa',

  textPrimary: '#ffffff',
  textSecondary: '#a0a0a0',
  textMuted: '#666666',
  textInverse: '#000000',

  cardRadius: 6,
  badgeRadius: 4,
  cardBorderWidth: 1.5,
  letterSpacingTactical: 0.6,

  fontTitle: FONTS.monoBold || 'monospace',
  fontBody: FONTS.monoRegular || 'monospace',
  fontMono: FONTS.monoRegular || 'monospace',
};

export function getTheme(mode: ThemeMode = 'civic'): ThemeColors {
  return mode === 'tactical' ? THEME_TACTICAL : THEME_CIVIC;
}
