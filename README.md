# FieldKit - Offline PWA Suite

An offline-first Progressive Web App suite served by a compact Go server. It bundles many independent tools and games that run locally, with optional network features for selected apps.

## Install Buttons

[![Install One App](https://img.shields.io/badge/Install-One%20App-0ea5e9?style=for-the-badge)](https://raw.githubusercontent.com/USERNAME/REPO/main/scripts/install-app.sh)
[![Install All Apps](https://img.shields.io/badge/Install-All%20Apps-22c55e?style=for-the-badge)](https://raw.githubusercontent.com/USERNAME/REPO/main/scripts/install-all.sh)
[![Install Go Launcher](https://img.shields.io/badge/Go%20Install-Launcher-6366f1?style=for-the-badge)](https://pkg.go.dev/github.com/USERNAME/prosepilot-launcher)

Replace `USERNAME/REPO` with your real repository path before publishing.

## Quick Start

Requirements:

- Go 1.22+
- Node.js + npm (optional, for Playwright tests)

Run locally:

```bash
go run .
```

Install launcher from GitHub:

```bash
go install github.com/USERNAME/fieldkit-launcher@latest
```

Validate locally before publish:

```bash
go mod edit -module github.com/USERNAME/fieldkit-launcher
go test ./...
go build ./...
```

Install one app from README-linked script:

```bash
curl -sSL https://raw.githubusercontent.com/USERNAME/REPO/main/scripts/install-app.sh | bash -s -- OWNER REPO accent-speaker
```

Install all apps from README-linked script:

```bash
curl -sSL https://raw.githubusercontent.com/USERNAME/REPO/main/scripts/install-all.sh | bash -s -- OWNER REPO
```

## App Categories

See [APPS_CATEGORIES.md](APPS_CATEGORIES.md) for the full list grouped into:

- Airplane mode
- Wi-Fi / Cell

The launcher also includes a connectivity filter with these same two categories.

## Direct App Links

### Airplane Mode

- [Clock](clock/index.html)
- [Pomodoro](pomodoro/index.html)
- [Kanban](kanban/index.html)
- [Time Tracker](time-tracker/index.html)
- [Habit Tracker](habit-tracker/index.html)
- [Snippet Board](snippet-board/index.html)
- [Battleship](battleship/index.html)
- [Snake](snake/index.html)
- [Tic-Tac-Toe](tic-tac-toe/index.html)
- [Math Raindrops](math-raindrops/index.html)
- [Pattern Mirror](pattern-mirror/index.html)
- [Odd One Out](odd-one-out/index.html)
- [Acronym List](acronym-list/index.html)
- [Employee Skills](employee-skills/index.html)
- [Drivers License Study](drivers-license/index.html)
- [Linux Trainer](linux-trainer/index.html)
- [JS Trainer](js-trainer/index.html)
- [Math Trainer](math-trainer/index.html)
- [MIDI Note Helper](midi-note-helper/index.html)
- [Music Player](music-player/index.html)
- [Positive IQ](positive-iq/index.html)
- [DocketPro](docketpro/index.html)
- [Legal Library](legal-library/index.html)

### Wi-Fi / Cell

- [Field Check-In](field-checkin/index.html)
- [Wishlist Studio](wishlist/index.html)
- [Support Desk](support/index.html)
- [Authority Assistant](authority-assistant/index.html)
- [Outdoor Kit](outdoor-kit/index.html)
- [Privacy Camera](privacy-camera/index.html)
- [Privacy Recorder](privacy-recorder/index.html)
- [Audio Notes Recorder](audio-notes/index.html)
- [Image Rater Lab](image-rater/index.html)

## Testing

```bash
npm ci
npm test
```
