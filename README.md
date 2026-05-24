# Random Quote App

A mobile quote-of-the-day demo built with Expo and React Native. The app presents a single animated quote experience with selectable quote categories, theme preferences, shake-to-refresh interaction, banner ads, and an optional remove-ads purchase flow.

## What the app does

- Shows a random quote from bundled local quote collections.
- Lets users switch between quote categories, including inspirational quotes, jokes, and multiple pickup-line styles.
- Picks a different quote when the user taps for the next quote or physically shakes the device.
- Saves the selected quote category and theme preference locally on the device.
- Supports light, dark, and system theme modes.
- Renders an animated crystal-ball style quote display using Skia shaders and React Native animations.
- Displays a banner ad for non-Pro users.
- Includes a remove-ads flow backed by RevenueCat subscriptions/purchases.

## Tech stack

- **JavaScript** for application code.
- **React 19** and **React Native 0.81** for the mobile UI.
- **Expo SDK 54** for app tooling and native integration.
- **Expo Dev Client** for native development builds.
- **Expo Sensors** for accelerometer-based shake detection.
- **React Native Async Storage** for local preference persistence.
- **Shopify React Native Skia** for the animated shader-based orb visual.
- **EAS Build** configuration for development, preview, and production builds.
- **ESLint** with Expo configuration for linting.

## Third-party services and APIs

- **Google Mobile Ads** via `react-native-google-mobile-ads`
  - Used to display banner ads.
  - The current demo code uses Google Mobile Ads test banner IDs.

- **RevenueCat** via `react-native-purchases` and `react-native-purchases-ui`
  - Used for customer entitlement checks, the remove-ads paywall, purchase restore, and customer center.
  - API keys are read from environment variables:
    - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
    - `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`
    - `EXPO_PUBLIC_REVENUECAT_API_KEY`

- **Expo / EAS**
  - Used for local development, native builds, and app configuration.

The quote content itself is stored in this repository under `src/constants/quotes/`. The app does not call a third-party quote API.

## Project structure

```text
.
+-- App.js                         # Main React Native app screen and interactions
+-- app.json                       # Expo app metadata
+-- eas.json                       # EAS build profiles
+-- index.js                       # App entry point
+-- assets/                        # App icons and image assets
`-- src/
    +-- constants/
    |   +-- quotes.js              # Quote category registry
    |   `-- quotes/                # Local quote collections
    `-- utils/
        `-- quotePicker.js         # Random quote helper
```

## Getting started

Install dependencies:

```bash
npm install
```

Start the Expo development server:

```bash
npm start
```

Run on Android or iOS with a development build:

```bash
npm run android
npm run ios
```

Run linting:

```bash
npm run lint
```

## Environment variables

RevenueCat integration is optional for reading and exploring the app, but purchase and restore flows require RevenueCat API keys. Create an `.env` file for local development if needed:

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=your_ios_key
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=your_android_key
EXPO_PUBLIC_REVENUECAT_API_KEY=your_fallback_key
```

`.env.*` files are ignored by Git.

## Notes

- This is a public-facing demo app, not a production store listing.
- Production ad monetization requires replacing the test ad unit with a real Google Mobile Ads unit.
- Production in-app purchases require matching RevenueCat products, offerings, and entitlement configuration.
