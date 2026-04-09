# Plan Review Findings

This file captures the explicit review prompts requested for agent-driven development.

## 1) Missing tests, broken tests, dead code

### Test coverage findings

- Added launcher connectivity test coverage in `tests/launcher.spec.js`.
- Existing Playwright suite passes after changes (57 passing).
- No immediately obvious dead code introduced by this feature.

### Follow-ups

- Consider adding shell-level tests (or CI smoke checks) for `scripts/install-app.sh` and `scripts/install-all.sh`.

## 2) Duplication and abstraction opportunities

### Duplication findings

- `index.html` launcher script is feature-rich and monolithic.
- Repeated helper patterns exist for localStorage access and rendering.

### Suggested abstraction

- Extract launcher JS into `shared/launcher.js` and keep `index.html` mostly declarative.
- Extract badge rendering and filter/state helpers into separate pure functions for easier testing.

## 3) Documentation gap review

### Documentation findings

- README now contains install badges, direct links, and connectivity categories.
- Added `APPS_CATEGORIES.md`, `CHANGELOG.md`, and release notes template.
- Added `copilot-instructions.md` for expected development flow.

### Documentation follow-ups

- Confirm all repository links use `george-shepov/FieldKit` before publish.
- Add screenshots/GIFs for top 6 apps to improve portfolio conversion.
