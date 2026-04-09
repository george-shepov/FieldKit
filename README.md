# FieldKit - Offline PWA Suite

An offline-first Progressive Web App suite served by a compact Go server. It bundles many independent tools and games that run locally, with optional network features for selected apps.

## Install Buttons

[![Install One App](https://img.shields.io/badge/Install-One%20App-0ea5e9?style=for-the-badge)](https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh)
[![Install All Apps](https://img.shields.io/badge/Install-All%20Apps-22c55e?style=for-the-badge)](https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-all.sh)
[![Install Go Launcher](https://img.shields.io/badge/Go%20Install-Launcher-6366f1?style=for-the-badge)](https://pkg.go.dev/github.com/george-shepov/FieldKit)

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
go install github.com/george-shepov/FieldKit@latest
```

Validate locally before publish:

```bash
go mod edit -module github.com/george-shepov/FieldKit
go test ./...
go build ./...
```

Install one app from README-linked script:

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit accent-speaker
```

Install all apps from README-linked script:

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-all.sh | bash -s -- george-shepov FieldKit
```

## App Categories

See [APPS_CATEGORIES.md](APPS_CATEGORIES.md) for the full list grouped into:

- Airplane mode
- Wi-Fi / Cell

The launcher also includes a connectivity filter with these same two categories.

## Direct App Links

Use the install buttons per app, or install the whole suite at once.

[![Install All Apps](https://img.shields.io/badge/Install-All%20Apps-22c55e?style=for-the-badge)](https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-all.sh)

### Airplane Mode

| App | Open | Install |
| --- | --- | --- |
| Clock | [Open](clock/index.html) | [![Install](https://img.shields.io/badge/Install-Clock-0ea5e9?style=flat-square)](#install-clock) |
| Pomodoro | [Open](pomodoro/index.html) | [![Install](https://img.shields.io/badge/Install-Pomodoro-0ea5e9?style=flat-square)](#install-pomodoro) |
| Kanban | [Open](kanban/index.html) | [![Install](https://img.shields.io/badge/Install-Kanban-0ea5e9?style=flat-square)](#install-kanban) |
| Time Tracker | [Open](time-tracker/index.html) | [![Install](https://img.shields.io/badge/Install-Time%20Tracker-0ea5e9?style=flat-square)](#install-time-tracker) |
| Habit Tracker | [Open](habit-tracker/index.html) | [![Install](https://img.shields.io/badge/Install-Habit%20Tracker-0ea5e9?style=flat-square)](#install-habit-tracker) |
| Snippet Board | [Open](snippet-board/index.html) | [![Install](https://img.shields.io/badge/Install-Snippet%20Board-0ea5e9?style=flat-square)](#install-snippet-board) |
| Battleship | [Open](battleship/index.html) | [![Install](https://img.shields.io/badge/Install-Battleship-0ea5e9?style=flat-square)](#install-battleship) |
| Snake | [Open](snake/index.html) | [![Install](https://img.shields.io/badge/Install-Snake-0ea5e9?style=flat-square)](#install-snake) |
| Tic-Tac-Toe | [Open](tic-tac-toe/index.html) | [![Install](https://img.shields.io/badge/Install-Tic--Tac--Toe-0ea5e9?style=flat-square)](#install-tic-tac-toe) |
| Math Raindrops | [Open](math-raindrops/index.html) | [![Install](https://img.shields.io/badge/Install-Math%20Raindrops-0ea5e9?style=flat-square)](#install-math-raindrops) |
| Pattern Mirror | [Open](pattern-mirror/index.html) | [![Install](https://img.shields.io/badge/Install-Pattern%20Mirror-0ea5e9?style=flat-square)](#install-pattern-mirror) |
| Odd One Out | [Open](odd-one-out/index.html) | [![Install](https://img.shields.io/badge/Install-Odd%20One%20Out-0ea5e9?style=flat-square)](#install-odd-one-out) |
| Acronym List | [Open](acronym-list/index.html) | [![Install](https://img.shields.io/badge/Install-Acronym%20List-0ea5e9?style=flat-square)](#install-acronym-list) |
| Employee Skills | [Open](employee-skills/index.html) | [![Install](https://img.shields.io/badge/Install-Employee%20Skills-0ea5e9?style=flat-square)](#install-employee-skills) |
| Drivers License Study | [Open](drivers-license/index.html) | [![Install](https://img.shields.io/badge/Install-Drivers%20License-0ea5e9?style=flat-square)](#install-drivers-license) |
| Linux Trainer | [Open](linux-trainer/index.html) | [![Install](https://img.shields.io/badge/Install-Linux%20Trainer-0ea5e9?style=flat-square)](#install-linux-trainer) |
| JS Trainer | [Open](js-trainer/index.html) | [![Install](https://img.shields.io/badge/Install-JS%20Trainer-0ea5e9?style=flat-square)](#install-js-trainer) |
| Math Trainer | [Open](math-trainer/index.html) | [![Install](https://img.shields.io/badge/Install-Math%20Trainer-0ea5e9?style=flat-square)](#install-math-trainer) |
| MIDI Note Helper | [Open](midi-note-helper/index.html) | [![Install](https://img.shields.io/badge/Install-MIDI%20Note%20Helper-0ea5e9?style=flat-square)](#install-midi-note-helper) |
| Music Player | [Open](music-player/index.html) | [![Install](https://img.shields.io/badge/Install-Music%20Player-0ea5e9?style=flat-square)](#install-music-player) |
| Positive IQ | [Open](positive-iq/index.html) | [![Install](https://img.shields.io/badge/Install-Positive%20IQ-0ea5e9?style=flat-square)](#install-positive-iq) |
| DocketPro | [Open](docketpro/index.html) | [![Install](https://img.shields.io/badge/Install-DocketPro-0ea5e9?style=flat-square)](#install-docketpro) |
| Legal Library | [Open](legal-library/index.html) | [![Install](https://img.shields.io/badge/Install-Legal%20Library-0ea5e9?style=flat-square)](#install-legal-library) |

### Wi-Fi / Cell

| App | Open | Install |
| --- | --- | --- |
| Field Check-In | [Open](field-checkin/index.html) | [![Install](https://img.shields.io/badge/Install-Field%20Check--In-0ea5e9?style=flat-square)](#install-field-checkin) |
| Wishlist Studio | [Open](wishlist/index.html) | [![Install](https://img.shields.io/badge/Install-Wishlist%20Studio-0ea5e9?style=flat-square)](#install-wishlist) |
| Support Desk | [Open](support/index.html) | [![Install](https://img.shields.io/badge/Install-Support%20Desk-0ea5e9?style=flat-square)](#install-support) |
| Authority Assistant | [Open](authority-assistant/index.html) | [![Install](https://img.shields.io/badge/Install-Authority%20Assistant-0ea5e9?style=flat-square)](#install-authority-assistant) |
| Outdoor Kit | [Open](outdoor-kit/index.html) | [![Install](https://img.shields.io/badge/Install-Outdoor%20Kit-0ea5e9?style=flat-square)](#install-outdoor-kit) |
| Privacy Camera | [Open](privacy-camera/index.html) | [![Install](https://img.shields.io/badge/Install-Privacy%20Camera-0ea5e9?style=flat-square)](#install-privacy-camera) |
| Privacy Recorder | [Open](privacy-recorder/index.html) | [![Install](https://img.shields.io/badge/Install-Privacy%20Recorder-0ea5e9?style=flat-square)](#install-privacy-recorder) |
| Audio Notes Recorder | [Open](audio-notes/index.html) | [![Install](https://img.shields.io/badge/Install-Audio%20Notes-0ea5e9?style=flat-square)](#install-audio-notes) |
| Image Rater Lab | [Open](image-rater/index.html) | [![Install](https://img.shields.io/badge/Install-Image%20Rater-0ea5e9?style=flat-square)](#install-image-rater) |

## Install Commands (Per App)

Replace `OWNER` and `REPO` with your repository path.

### Install clock

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit clock
```

### Install pomodoro

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit pomodoro
```

### Install kanban

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit kanban
```

### Install time-tracker

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit time-tracker
```

### Install habit-tracker

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit habit-tracker
```

### Install snippet-board

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit snippet-board
```

### Install battleship

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit battleship
```

### Install snake

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit snake
```

### Install tic-tac-toe

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit tic-tac-toe
```

### Install math-raindrops

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit math-raindrops
```

### Install pattern-mirror

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit pattern-mirror
```

### Install odd-one-out

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit odd-one-out
```

### Install acronym-list

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit acronym-list
```

### Install employee-skills

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit employee-skills
```

### Install drivers-license

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit drivers-license
```

### Install linux-trainer

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit linux-trainer
```

### Install js-trainer

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit js-trainer
```

### Install math-trainer

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit math-trainer
```

### Install midi-note-helper

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit midi-note-helper
```

### Install music-player

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit music-player
```

### Install positive-iq

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit positive-iq
```

### Install docketpro

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit docketpro
```

### Install legal-library

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit legal-library
```

### Install field-checkin

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit field-checkin
```

### Install wishlist

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit wishlist
```

### Install support

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit support
```

### Install authority-assistant

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit authority-assistant
```

### Install outdoor-kit

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit outdoor-kit
```

### Install privacy-camera

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit privacy-camera
```

### Install privacy-recorder

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit privacy-recorder
```

### Install audio-notes

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit audio-notes
```

### Install image-rater

```bash
curl -sSL https://raw.githubusercontent.com/george-shepov/FieldKit/main/scripts/install-app.sh | bash -s -- george-shepov FieldKit image-rater
```

## Testing

```bash
npm ci
npm test
```
