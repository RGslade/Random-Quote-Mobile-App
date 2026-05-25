# Accessibility Notes

The app is designed as a visual and interaction showcase, but the core quote experience should remain usable with assistive technologies and motion sensitivity settings.

## Implemented

- Key controls expose accessibility roles, labels, hints, and selected or checked state.
- The quote display is tappable and announces the current quote as part of its accessible label.
- Quote text supports dynamic type within a controlled multiplier so larger text remains readable inside the fixed orb layout.
- Light, dark, and system themes are supported, with contrast checked against the main quote, toolbar, and modal surfaces.
- The app respects system reduced motion and also includes a persisted reduced-motion toggle in the theme menu.

## Manual Checks

- VoiceOver and TalkBack order through the toolbar, category menu, quote surface, ad removal button, and modal.
- Dynamic text sizes still fit the quote window for short and medium-length quotes.
- Reduced motion disables idle floating, shader drift updates, menu movement, and reveal movement.
- Shake-to-refresh remains optional because tap and swipe also reveal a new quote.

## Future Improvements

- Add automated accessibility assertions for rendered controls once component-level tests are introduced.
- Review every quote category for unusually long strings that may need a larger layout variant.
- Add localized accessibility labels if the app is prepared for localization.
