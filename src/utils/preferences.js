export const THEME_OPTIONS = ['system', 'light', 'dark'];

export function getValidThemePreference(value, fallback = 'system') {
  return THEME_OPTIONS.includes(value) ? value : fallback;
}

export function getValidQuoteMode(value, availableModes, fallback) {
  if (!Array.isArray(availableModes) || availableModes.length === 0) return fallback;
  return availableModes.includes(value) ? value : fallback ?? availableModes[0];
}

export function getValidBooleanPreference(value, fallback = false) {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return fallback;
}
