# Testing Notes

The current automated tests focus on deterministic helper logic rather than native UI rendering. That keeps CI fast and avoids brittle mocks around ads, purchases, sensors, and Skia.

## Current Coverage

- `pickDifferentQuote` handles empty lists, single-item lists, and avoids immediate repetition when multiple quotes are available.
- Preference helpers validate stored theme, category, and reduced-motion values before they are applied to app state.

## Commands

```bash
npm test
npm run test:watch
npm run lint
```

## Manual Integration Checks

- Start the Expo dev server and verify tap, swipe, and shake all reveal quotes.
- Change categories and restart the app to confirm persistence.
- Toggle light, dark, system, and reduced-motion settings.
- Confirm Google Mobile Ads test banners display in a native development build.
- Open the remove-ads modal with and without RevenueCat public API keys configured.

## Planned Improvements

- Add React Native Testing Library for component-level accessibility and state tests.
- Add smoke tests for the purchase modal in demo mode with RevenueCat mocked.
- Add an E2E flow for a native development build once the app has stable screen IDs.
