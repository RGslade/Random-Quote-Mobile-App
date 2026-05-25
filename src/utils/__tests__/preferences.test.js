import { describe, expect, it } from '@jest/globals';

import {
  getValidBooleanPreference,
  getValidQuoteMode,
  getValidThemePreference,
} from '../preferences';

describe('preference helpers', () => {
  it('keeps valid theme preferences and falls back for unknown values', () => {
    expect(getValidThemePreference('dark')).toBe('dark');
    expect(getValidThemePreference('light')).toBe('light');
    expect(getValidThemePreference('neon')).toBe('system');
  });

  it('keeps valid quote modes and falls back safely', () => {
    const modes = ['jokes', 'inspirational'];

    expect(getValidQuoteMode('jokes', modes, 'inspirational')).toBe('jokes');
    expect(getValidQuoteMode('missing', modes, 'inspirational')).toBe('inspirational');
    expect(getValidQuoteMode('missing', modes)).toBe('jokes');
  });

  it('normalizes boolean preferences stored as strings', () => {
    expect(getValidBooleanPreference('true')).toBe(true);
    expect(getValidBooleanPreference('false', true)).toBe(false);
    expect(getValidBooleanPreference('unknown', true)).toBe(true);
  });
});
