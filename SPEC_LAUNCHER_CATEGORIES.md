Feature: Launcher categories and offline/online badges

Goal
- Group apps in the launcher into two categories: "Airplane mode" (offline-first) and "Wi‑Fi / Cell" (requires/benefits from network).
- Add a small badge on each app tile indicating "offline" or "online features" (color-coded).
- Make category filtering available in the launcher UI (tabs or segmented control).

Acceptance criteria
- The launcher shows two clearly labeled sections or toggle allowing users to view "Airplane mode" and "Wi‑Fi / Cell" apps.
- Each app tile displays a badge: green for Offline (core functionality works without network), orange for Online features (has optional/required network sync/API).
- Apps categorized in `APPS_CATEGORIES.md` are reflected in the launcher UI.
- Existing offline-first apps continue to work unchanged.
- Playwright E2E tests cover: launcher loads, category toggle works, badges render for a sample of apps (at least one offline and one online app).
- All new UI text and screenshots are documented in `README.md` and `APPS_CATEGORIES.md` before code changes.

Implementation notes
- Minimal DOM/JS changes in `fieldkit-launcher` or main `index.html`/launcher file to avoid large refactor.
- Add a small CSS class for badges, keep visual change small and reversible.
- Tests: add Playwright tests in `tests/launcher.spec.js` that assert category toggle and badges.

Docs updates (must be done before code)
- Add this SPEC file (done).
- Update `README.md` to mention launcher categories and how to enable airplane-mode view.
- Update `APPS_CATEGORIES.md` (already present) if any app mapping needs correction.
- Add a short dev note to `copilot-instructions.md` describing the feature and testing expectations.

Testing
- Unit: none required for small DOM-only change (optional DOM helper tests can be added later).
- E2E: Playwright tests added as `tests/launcher.spec.js`.
- Run full test suite: `npm test` and ensure all existing tests pass.

Rollback plan
- Feature will be gated behind a small `data-` attribute/class. Revert by removing the class and tests.

Timeline (approx)
1. Docs update (this SPEC and `copilot-instructions.md`).
2. Add Playwright tests scaffold.
3. Implement launcher UI changes.
4. Run tests & lint.
5. Run Copilot Code Review loop until resolved.
6. Human review and polish README and screenshots.
