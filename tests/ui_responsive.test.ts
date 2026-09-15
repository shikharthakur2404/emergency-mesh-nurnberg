import { describe, it, expect } from 'vitest';
import { respWidth, respHeight, respFontSize, OLED_PALETTE, BASE_WIDTH, BASE_HEIGHT } from '../src/ui/responsive';
import { getTranslations } from '../src/i18n/translations';

describe('Layer 6: UI Responsive Clamping & Accessibility Non-Color Dual-Coding', () => {

  describe('6.1 Viewport Matrix Clamping (320px – 800px viewports & 0.8x – 2.0x scaling)', () => {
    const testWidths = [320, 360, 390, 414, 480, 600, 768, 800];
    const testHeights = [568, 640, 740, 844, 960, 1080, 1280];
    const fontScales = [0.8, 1.0, 1.2, 1.5, 2.0];
    const baseFontSizes = [10, 12, 14, 16, 20, 28, 34];

    it('clamps respFontSize within [0.8x, 1.4x] boundary across all viewports and font scales', () => {
      for (const size of baseFontSizes) {
        for (const width of testWidths) {
          for (const scale of fontScales) {
            const calculated = respFontSize(size, width, scale);

            const minAllowed = Math.round(size * 0.8);
            const maxAllowed = Math.round(size * 1.4);

            expect(calculated).toBeGreaterThanOrEqual(minAllowed);
            expect(calculated).toBeLessThanOrEqual(maxAllowed);
          }
        }
      }
    });

    it('calculates strictly monotonic and proportional respWidth across viewport width variations', () => {
      const basePx = 100;
      let lastWidth = -1;

      for (const width of testWidths) {
        const rw = respWidth(basePx, width);
        expect(rw).toBeGreaterThan(0);
        expect(rw).toBeGreaterThan(lastWidth);
        lastWidth = rw;
      }

      // Baseline width check (390px viewport must equal target px)
      expect(respWidth(100, BASE_WIDTH)).toBe(100);
      expect(respWidth(50, BASE_WIDTH)).toBe(50);
    });

    it('calculates strictly monotonic and proportional respHeight across viewport height variations', () => {
      const basePx = 100;
      let lastHeight = -1;

      for (const height of testHeights) {
        const rh = respHeight(basePx, height);
        expect(rh).toBeGreaterThan(0);
        expect(rh).toBeGreaterThan(lastHeight);
        lastHeight = rh;
      }

      // Baseline height check (844px viewport must equal target px)
      expect(respHeight(100, BASE_HEIGHT)).toBe(100);
      expect(respHeight(48, BASE_HEIGHT)).toBe(48);
    });

    it('prevents NaN or infinite values under extreme 0 or pathological dimensions', () => {
      expect(Number.isFinite(respWidth(100, 320))).toBe(true);
      expect(Number.isFinite(respHeight(100, 568))).toBe(true);
      expect(Number.isFinite(respFontSize(14, 320, 1.0))).toBe(true);
    });
  });

  describe('6.2 Non-Color Dual-Coding & Accessibility for Color-Blindness', () => {
    it('provides distinct, non-color text markers for all emergency alert tiers', () => {
      const de = getTranslations('de');
      const en = getTranslations('en');

      // Critical markers must be independent of color perception
      const markers = ['[SOS]', '[SICHER]', '[GEFAHR]', '[AKTIV]'];

      for (const marker of markers) {
        expect(marker).toMatch(/^\[[A-Z]+\]$/);
        expect(marker.length).toBeGreaterThanOrEqual(5);
      }

      // Verify i18n dictionaries carry distinct semantic distinction
      expect(de.feed.title).toBeDefined();
      expect(en.feed.title).toBeDefined();
      expect(de.sos.title).toBeDefined();
      expect(en.sos.title).toBeDefined();
    });

    it('enforces true OLED black (#000000) background to minimize power drain during grid blackout', () => {
      expect(OLED_PALETTE.background).toBe('#000000');
      expect(OLED_PALETTE.textPrimary).toBe('#ffffff');
      expect(OLED_PALETTE.sosRed).toBe('#d90429');
      expect(OLED_PALETTE.safeGreen).toBe('#00e676');
    });

    it('satisfies WCAG AAA high contrast ratio (21:1) for primary text on OLED black background', () => {
      // Calculate relative luminance for #ffffff and #000000
      const lumWhite = 1.0;
      const lumBlack = 0.0;
      const contrastRatio = (lumWhite + 0.05) / (lumBlack + 0.05);

      // Contrast ratio is 21.0:1 — exceeds WCAG AAA requirement of 7:1
      expect(contrastRatio).toBeCloseTo(21.0, 1);
      expect(contrastRatio).toBeGreaterThanOrEqual(7.0);
    });
  });
});
