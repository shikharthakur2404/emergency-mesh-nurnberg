import { Platform } from 'react-native';

/**
 * Emergency Mesh Nürnberg — Tactical Typography System
 * Features:
 * - Rajdhani (Bold, SemiBold, Medium, Regular): High-impact, geometric, tactical sci-fi HUD display font
 * - JetBrains Mono (Bold, SemiBold, Medium, Regular): Precision telemetry, coordinates, packet digests, signatures
 */
export const FONTS = {
  // Display & Headers (Rajdhani)
  displayBold: Platform.select({
    android: 'Rajdhani-Bold',
    default: 'System',
  }),
  displaySemiBold: Platform.select({
    android: 'Rajdhani-SemiBold',
    default: 'System',
  }),
  displayMedium: Platform.select({
    android: 'Rajdhani-Medium',
    default: 'System',
  }),
  displayRegular: Platform.select({
    android: 'Rajdhani-Regular',
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
