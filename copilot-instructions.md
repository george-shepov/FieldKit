# Copilot Instructions — Launcher categories feature

Summary

Add a small launcher feature to group apps by connectivity: `Airplane mode` and `Wi‑Fi / Cell`. Keep changes small and testable.

Before coding

- Read `SPEC_LAUNCHER_CATEGORIES.md` and `APPS_CATEGORIES.md` to find which apps are offline vs online.
- Update `README.md` to document the feature and developer test commands.

Coding notes

- Modify the launcher file (likely `index.html` or `prosepilot-launcher`) to add category controls and a small badge element for each app tile.
- Keep all new UI behind a `data-feature-launcher-categories` attribute on the root launcher element so it is easy to toggle.
- Use minimal CSS: `.badge.offline { background:#16a34a } .badge.online { background:#f97316 }`.

Testing

- Add `tests/launcher.spec.js` Playwright tests: check launcher loads, tabs toggle, and badges render for two sample apps.
- Run the full test suite: `npm test` and fix any regressions.

Review loop

- After implementing, request Copilot Code Review.
- Address feedback and re-request review until all relevant comments are resolved.

Notes for reviewers

- Keep changes minimal and avoid refactoring unrelated code.
- Verify categories reflect `APPS_CATEGORIES.md` and that badges do not alter existing app behavior.
