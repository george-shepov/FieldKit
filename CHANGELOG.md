# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Launcher connectivity filter with two categories: `Airplane Mode` and `Wi-Fi / Cell`.
- Connectivity badges on app tiles aligned to the two categories.
- New Playwright test coverage in `tests/launcher.spec.js` for connectivity filtering.
- Installer scripts for portfolio/readme workflow:
  - `scripts/install-app.sh` (install one app from GitHub archive)
  - `scripts/install-all.sh` (install all index.html app folders from GitHub archive)
- Portfolio-focused docs:
  - `README.md` install badges and direct app links
  - `APPS_CATEGORIES.md` grouped app list
  - `SPEC_LAUNCHER_CATEGORIES.md`
  - `copilot-instructions.md`

### Changed

- Launcher legend wording to clearly describe offline vs network-enabled grouping.
- README structure to support direct GitHub portfolio navigation.

### Testing

- Full Playwright suite passing locally: 57 tests.
