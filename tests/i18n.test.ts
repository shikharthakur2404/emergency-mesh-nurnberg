import { describe, it, expect } from 'vitest';
import { getTranslations, TRANSLATIONS } from '../src/i18n/translations';

describe('Bilingual i18n Subsystem', () => {
  it('loads German translations by default', () => {
    const tDe = getTranslations('de');
    expect(tDe.header.title).toBe('EMERGENCY MESH NÜRNBERG');
    expect(tDe.tabs.familie).toBe('FAMILIE');
    expect(tDe.tabs.orte).toBe('ORTE');
    expect(tDe.header.packets).toBe('PAKETE');
  });

  it('loads English translations when EN is selected', () => {
    const tEn = getTranslations('en');
    expect(tEn.header.title).toBe('EMERGENCY MESH NUREMBERG');
    expect(tEn.tabs.familie).toBe('FAMILY');
    expect(tEn.tabs.orte).toBe('PLACES');
    expect(tEn.header.packets).toBe('PACKETS');
  });

  it('contains consistent translation keys across both languages', () => {
    const deKeys = Object.keys(TRANSLATIONS.de) as Array<keyof typeof TRANSLATIONS.de>;
    const enKeys = Object.keys(TRANSLATIONS.en) as Array<keyof typeof TRANSLATIONS.en>;
    expect(deKeys.sort()).toEqual(enKeys.sort());

    for (const section of deKeys) {
      const deSubKeys = Object.keys(TRANSLATIONS.de[section]).sort();
      const enSubKeys = Object.keys(TRANSLATIONS.en[section]).sort();
      expect(deSubKeys).toEqual(enSubKeys);
    }
  });

  it('formats parameterized alert messages properly', () => {
    const tDe = getTranslations('de');
    const tEn = getTranslations('en');

    expect(tDe.sos.alertMessage('MEDICAL')).toContain('Öffentlicher MEDICAL-Notruf');
    expect(tEn.sos.alertMessage('MEDICAL')).toContain('Public MEDICAL distress beacon');

    expect(tDe.family.step1SavedBanner('Key123')).toBe('✓ Aktiv gekoppelt (Key123)');
    expect(tEn.family.step1SavedBanner('Key123')).toBe('✓ Securely Paired (Key123)');
  });
});
