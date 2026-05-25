import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { pickDifferentQuote } from '../quotePicker';

describe('pickDifferentQuote', () => {
  const originalRandom = Math.random;

  afterEach(() => {
    Math.random = originalRandom;
  });

  it('returns an empty string for missing quote lists', () => {
    expect(pickDifferentQuote(undefined, 'current')).toBe('');
    expect(pickDifferentQuote([], 'current')).toBe('');
  });

  it('returns the only quote when one quote is available', () => {
    expect(pickDifferentQuote(['only'], 'only')).toBe('only');
  });

  it('avoids immediately repeating the current quote when possible', () => {
    const values = [0, 0.75];
    Math.random = jest.fn(() => values.shift() ?? 0.75);

    expect(pickDifferentQuote(['current', 'next'], 'current')).toBe('next');
  });
});
