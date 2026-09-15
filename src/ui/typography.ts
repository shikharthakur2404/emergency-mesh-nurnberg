import { Platform } from 'react-native';

/**
 * Emergency Mesh Nürnberg — Civic Authority Typography System
 * Dual-Engine Hierarchy:
 * - Fira Sans Condensed (Bold, SemiBold, Medium, Regular): Official German grotesque DIN-lineage civic typeface
 * - JetBrains Mono (Bold, SemiBold, Medium, Regular): High-contrast technical telemetry, packet hashes, coordinates
 */
export const FONTS = {
  // Display & Civic Authority (DIN-Lineage: Fira Sans Condensed)
  displayBold: Platform.select({
    android: 'FiraSansCondensed-Bold',
    default: 'System',
  }),
  displaySemiBold: Platform.select({
    android: 'FiraSansCondensed-SemiBold',
    default: 'System',
  }),
  displayMedium: Platform.select({
    android: 'FiraSansCondensed-Medium',
    default: 'System',
  }),
  displayRegular: Platform.select({
    android: 'FiraSansCondensed-Regular',
    default: 'System',
  }),

  // Telemetry, Coordinates, Hashes, Technical Data (JetBrains Mono)
  monoBold: Platform.select({
    android: 'JetBrainsMono-Bold',
    default: 'monospace',
  }),
  monoSemiBold: Platform.select({
    android: 'JetBrainsMono-SemiBold',
    default: 'monospace',
  }),
  monoMedium: Platform.select({
    android: 'JetBrainsMono-Medium',
    default: 'monospace',
  }),
  monoRegular: Platform.select({
    android: 'JetBrainsMono-Regular',
    default: 'monospace',
  }),
};

/**
 * Letter-spacing (tracking) tokens for strict NATO / Cockpit monospace vs civic sans hierarchy.
 */
export const TRACKING = {
  condensed: -0.3,
  standard: 0,
  tactical: 0.6,
  trackedOut: 1.2,
  cockpitMono: 1.8,
} as const;

