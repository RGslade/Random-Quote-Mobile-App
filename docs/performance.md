# Performance Notes

This app is intentionally small, but the quote surface is built to demonstrate mobile animation and rendering choices that matter in larger React Native apps.

## Why Skia Is Used

The crystal-ball quote surface uses Shopify React Native Skia for the animated shader background. Skia keeps the rich visual effect out of normal React layout work and makes it possible to render a fluid procedural surface without shipping large image assets.

## Animation Decisions

- Quote changes use native-driver opacity, scale, and translate animations for a smoother reveal.
- The idle floating animation is intentionally subtle so the screen feels alive without distracting from the quote.
- Shake gestures trigger a short wobble, while system or user-selected reduced motion disables nonessential movement.
- Shader uniform updates are throttled so React state is not updated on every animation frame.

## Render Stability

- Quote selection is handled with a small pure helper that avoids immediate repetition when possible.
- Theme-aware styles are created with `useMemo` so the style object is rebuilt only when the resolved theme changes.
- Interaction handlers use `useCallback` where they are reused by effects or gesture responders.
- The quote category list is derived once from the quote registry and persisted by key, keeping the UI independent from quote content volume.

## Future Profiling

- Profile the Skia surface on older Android devices and low-power mode.
- Use React DevTools Profiler to inspect re-render paths during rapid quote changes.
- Measure startup and native module initialization cost for ads, RevenueCat, and sensors in development builds.
- Consider Reanimated if future gesture-driven transitions become more complex.
