# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FieldKit** is an offline-first Progressive Web App (PWA) suite served by a Go HTTP server. It bundles multiple productivity, learning, field tools, games, and privacy utilities into a single executable that works completely offline after initial load.

## Commands

### Run Development Server

```bash
go run .
```

### Build Release Binaries

```bash
./scripts/build-release.sh
```

### Package for Distribution

```bash
./scripts/package-release.sh
```

### Run with API Features

```bash
./prosepilot --enable-api --api-key "your-secret-key"
```

### Run with LAN Sharing (phone access)

```bash
./prosepilot --share
```

### Other Flags

- `--port` - HTTP port (default: 8787)
- `--host` - Bind host (default: 127.0.0.1)
- `--no-browser` - Disable auto-open browser
- `--open` - Path to open in browser
- `--data-dir` - Directory for API data storage

## Architecture

### Go Backend (`prosepilot.go`, `server_api.go`)

- Main HTTP server that embeds all static assets using Go 1.16+ `embed` package
- Serves API endpoints for registration, heartbeat, media uploads, chat, wishlist, support tickets
- Optional Google OAuth authentication

### Frontend Apps (individual `index.html` files)

- Vanilla HTML/CSS/JavaScript (no frameworks)
- Each app is a standalone tool accessible from the main launcher
- Apps live in directories: `pomodoro/`, `habit-tracker/`, `drivers-license/`, `games/`, etc.

### Shared Resources (`shared/`)

- `f1-help-nav.js` - F1 help system available across all apps
- `help-content.js` - Help content database
- `privacy-mode.js` - Privacy controls
- `ui-tweaks-runtime.js` - UI enhancements
- `global-auth.js` - Authentication utilities
- `suite-nav.css` - Navigation styles

### PWA Infrastructure

- `sw.js` - Service Worker for offline caching
- `manifest.webmanifest` - PWA manifest

## Development Notes

- Go 1.22+ is required (from `go.mod`)
- All HTML/JS/CSS files are embedded into the binary at compile time
- Build output goes to `dist/` directory
- Packaged releases go to `dist/packages/`
- The `.env` file stores OAuth credentials (not committed)
- Individual app directories contain their own `index.html` and any app-specific assets
