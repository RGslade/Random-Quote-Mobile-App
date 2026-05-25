# Random Quote App

A lightweight React Native/Expo quote app used as a mobile animation, sensor interaction, local persistence, monetisation and performance showcase.

The app gives users a fast, focused way to get a fresh quote from a chosen category. It is intentionally small: the value of the project is in the quality of the mobile experience rather than a large backend surface. It demonstrates how a simple consumer app can feel polished through native gestures, haptics, persisted preferences, accessibility-aware animation, Skia visuals, ads, and an optional remove-ads purchase flow.

## Key Features

- **Animated quote reveal**: quotes transition with a polished opacity, scale, and movement reveal so refreshes feel deliberate rather than abrupt.
- **Tap, swipe, and shake refresh**: users can tap the orb, swipe horizontally, or shake the device to reveal another quote.
- **Quote categories**: bundled local categories let users switch the tone of the app without depending on a network API.
- **Local persistence**: selected category, theme preference, and reduced-motion preference are stored with AsyncStorage.
- **Light, dark, and system theme modes**: the UI can follow the device theme or use an explicit user preference.
- **Reduced motion support**: the app respects system reduced-motion settings and includes an in-app reduced-motion toggle.
- **Haptic feedback**: subtle Expo Haptics feedback is used for quote reveals, category changes, theme/settings changes, and successful shakes.
- **Skia visual showcase**: the quote is displayed inside a shader-backed animated orb.
- **AdMob banner demo**: non-Pro users see a Google Mobile Ads banner using Google test IDs.
- **Optional RevenueCat remove-ads flow**: RevenueCat wiring is present for paywalls, restores, and customer center, but public credentials are not included.
- **Notifications dependency**: `@notifee/react-native` is installed in this public project, but notification behavior is not currently implemented in the app UI.

There is no AI integration, authentication, Supabase backend, TanStack Query layer, Expo Router navigation stack, or production API service in this Option A demo. Those are intentionally not claimed here because this repository is focused on the polished mobile interaction showcase.

## Technology Stack

- **React Native 0.81 and React 19**: core mobile UI, component state, layout, accessibility props, and native animation primitives.
- **Expo SDK 54**: app tooling, development server, native configuration, and Expo module integration.
- **JavaScript**: the current app is written in JavaScript to preserve the existing project structure. TypeScript would be a reasonable future upgrade if the app grows into deeper service and navigation layers.
- **Expo Dev Client**: supports native modules that are not available in Expo Go, including Google Mobile Ads, RevenueCat, Skia, and Notifee.
- **Expo Sensors**: accelerometer data powers shake-to-refresh.
- **Expo Haptics**: optional tactile feedback; failures are caught so unsupported platforms do not crash.
- **AsyncStorage**: persists local user preferences without a backend.
- **Shopify React Native Skia**: renders the procedural animated orb behind the quote.
- **React Native Google Mobile Ads**: displays a banner ad with Google Mobile Ads test IDs.
- **RevenueCat Purchases and Purchases UI**: optional/demo remove-ads entitlement, paywall, restore, and customer center flow.
- **Jest and jest-expo**: pure helper tests for quote selection and preference validation.
- **ESLint with Expo config**: project linting.
- **EAS Build**: development, preview, and production build profiles are configured in `eas.json`.

## Architecture

```text
.
+-- App.js                         # Single-screen app, interactions, animation, ads, purchases
+-- app.json                       # Expo metadata and native AdMob test app IDs
+-- eas.json                       # EAS build profiles
+-- index.js                       # App entry point
+-- assets/                        # App icons and image assets
+-- docs/                          # Performance, accessibility, and testing notes
+-- .github/workflows/validate.yml # Public CI validation
`-- src/
    +-- constants/
    |   +-- quotes.js              # Quote category registry
    |   `-- quotes/                # Bundled local quote collections
    `-- utils/
        +-- quotePicker.js         # Random quote selection helper
        +-- preferences.js         # Preference validation helpers
        `-- __tests__/             # Jest tests for pure helpers
```

The app is deliberately single-screen. UI state lives in `App.js` because there is no navigation stack or cross-screen domain model yet. Pure logic that benefits from tests is separated into `src/utils`. Quote data is separated from UI code under `src/constants` so categories can be expanded without changing interaction code.

State management is intentionally lightweight:

- **Local UI state**: menus, modal visibility, current quote, purchase loading state, and animation state live in React state/refs.
- **Persisted local state**: theme, category, and reduced-motion preferences are saved in AsyncStorage.
- **Purchase state**: RevenueCat customer info is normalized into a `hasPro` flag used to hide ads.
- **Server state**: no server-state library is used because this public demo does not fetch remote app data.
- **Authentication state**: not present in this repository.

## Backend and API Design

This public demo does not require a backend to run. Quotes are bundled locally and all core interactions work offline after the app is installed.

API/service integrations are limited to native monetisation SDKs:

- **Google Mobile Ads** uses the SDK test banner ID in code: `TestIds.BANNER`.
- **AdMob App IDs** are configured in `app.json` with Google test app IDs because the native SDK requires app IDs at build time.
- **RevenueCat** reads public SDK API keys from environment variables when available. Without keys, the remove-ads modal explains that RevenueCat is not configured.

There are no Supabase Edge Functions, OpenAI calls, service-role keys, or private backend credentials in this repository. In a production architecture, sensitive OpenAI, Supabase service-role, or payment webhook secrets would belong behind server-side boundaries such as Edge Functions or a backend API, never in the mobile client.

## Security

- Private credentials are intentionally excluded from Git.
- `.env` and `.env.*` files are ignored; `.env.example` documents expected keys.
- The app uses public Google Mobile Ads test identifiers only.
- RevenueCat API keys are optional public SDK keys and are loaded from environment variables.
- No production AdMob unit IDs, private RevenueCat data, OpenAI keys, Supabase service-role keys, or backend secrets are committed.
- Supabase Row Level Security and authentication assumptions do not apply to this current public demo because Supabase is not used.

## Environment Variables

Create `.env` from `.env.example` only if you want to test optional RevenueCat behavior. The app can run without private keys.

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
EXPO_PUBLIC_REVENUECAT_API_KEY=
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=ca-app-pub-3940256099942544~3347511713
EXPO_PUBLIC_ADMOB_IOS_APP_ID=ca-app-pub-3940256099942544~1458002511
EXPO_PUBLIC_ADMOB_BANNER_AD_UNIT_ID=ca-app-pub-3940256099942544/6300978111
```

AdMob banner rendering in the app uses `TestIds.BANNER`; the AdMob values above are Google test integration identifiers for safe public demo configuration.

## Running Locally

Use Node 20 where possible. The EAS development and production profiles currently specify Node `20.19.4`.

```bash
npm install
npm start
```

Run a native development build when testing Skia, sensors, haptics, ads, or RevenueCat:

```bash
npm run android
npm run ios
```

Useful validation commands:

```bash
npm run lint
npm test
npm run test:watch
```

The app is designed to run as a public demo without private credentials. RevenueCat purchase actions require your own RevenueCat project configuration if you want to test the full paywall and entitlement flow.

## Testing and Quality

Current automated tests cover pure helper logic:

- quote selection fallbacks
- avoiding immediate quote repetition where possible
- stored preference validation for theme, category, and reduced motion

Manual integration testing is still important because the most interesting behavior depends on native modules:

- tap, swipe, and shake quote refresh
- haptics on supported devices
- reduced-motion behavior
- AdMob test banner rendering in a dev build
- RevenueCat modal behavior with and without public SDK keys

Planned testing improvements include React Native Testing Library coverage for accessible controls, mocked RevenueCat modal states, and native smoke tests for the primary quote flow.

## Build and Release

`eas.json` includes development, preview, and production profiles. The repository does not include deployment, store submission automation, or production publishing steps.

Typical EAS commands:

```bash
npx eas build --profile development --platform android
npx eas build --profile preview --platform android
npx eas build --profile production --platform android
```

iOS builds require the usual Apple developer account and signing setup. Production monetisation requires replacing demo/test IDs with your own production AdMob and RevenueCat configuration outside the public repository.

## Screenshots and Demo

Suggested assets to add:

- **Animated quote orb**: main screen in light mode with an inspirational quote.
- **Dark mode**: same screen using the dark theme.
- **Category menu**: category selector open.
- **Reduced motion setting**: theme menu showing the motion toggle.
- **Remove ads modal**: RevenueCat demo state without private credentials.
- **Gesture demo GIF**: swipe or shake refresh showing the quote reveal.

## Animation and Performance Showcase

The app uses a Skia runtime shader for the animated orb, native-driver animations for quote reveal and menu motion, throttled shader uniform updates, and memoized styles for theme changes. Reduced motion stops decorative motion while preserving the core quote experience.

See [docs/performance.md](docs/performance.md) for implementation notes and future profiling ideas.

## Accessibility

The app includes accessibility roles, labels, hints, selected/checked state, dynamic text support for the quote, light/dark contrast checks, and reduced-motion support.

See [docs/accessibility.md](docs/accessibility.md) for manual checks and future improvements.

## GitHub Actions and CI

The validation workflow installs dependencies with `npm ci`, runs Expo linting, and runs Jest tests. It is intentionally limited to public portfolio validation and does not build, deploy, publish, or submit the app.

## Known Limitations

- RevenueCat behavior is optional unless you provide your own public SDK API keys and product setup.
- The app uses AdMob test IDs only; production ad units are intentionally not included.
- Quote content is local and static.
- No backend, Supabase, authentication, AI generation, push notification workflow, analytics pipeline, or remote configuration is implemented in this public demo.
- Automated tests currently focus on helper logic, not full React Native component rendering.
- The app is optimized as a portfolio/demo experience, not a production quote platform with accounts and sync.

## Roadmap

- Add React Native Testing Library coverage for the main screen.
- Add E2E smoke tests for tap, category change, and reduced-motion flows.
- Add screenshots and a short demo video.
- Profile Skia and native module startup on lower-end Android devices.
- Expand accessibility checks with screen reader passes and larger text layouts.
- Improve offline resilience and error handling around optional monetisation services.
- Add richer analytics in a privacy-conscious way for production builds.
- Consider a future Option B architecture with Supabase, Edge Functions, authentication, AI-assisted quote generation, and a journal/history model.

## For Technical Reviewers

Start with these files:

- [App.js](App.js): native interactions, animation, theme handling, ads, RevenueCat demo flow, haptics, accessibility props, and reduced-motion behavior.
- [src/utils/quotePicker.js](src/utils/quotePicker.js): quote selection logic with immediate-repeat avoidance.
- [src/utils/preferences.js](src/utils/preferences.js): defensive preference validation before applying persisted values.
- [src/constants/quotes.js](src/constants/quotes.js): category registry and separation of local data from UI code.
- [docs/performance.md](docs/performance.md): rendering and animation rationale.
- [.github/workflows/validate.yml](.github/workflows/validate.yml): public CI validation.

The project is intentionally modest in scope. The review focus should be the mobile-specific implementation quality: gestures, sensors, haptics, animation, persisted settings, public-safe monetisation wiring, and clear boundaries around what is and is not included in the demo.
