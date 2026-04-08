# App Categories

This document groups the included apps into two simple categories to help present the project in a portfolio and explain which apps work fully offline.

**Airplane mode (fully offline / core functionality works without a network)**
- accent-speaker
- acronym-list
- battleship
- clock
- docketpro
- drivers-license
- employee-skills
- games/* (many games are offline: Tic-Tac-Toe, Snake, Battleship, Reversi, etc.)
- habit-tracker
- kanban
- math-raindrops
- math-trainer
- midi-note-helper
- music-player
- music-trainer
- pomodoro
- positive-iq
- profile (local UI)
- receipt-tracker
- pattern-mirror
- puzzle / brain games (odd-one-out, positive-iq-test, etc.)
- time-tracker
- ui-tweaker
- many small tools under root directories that do not call remote endpoints

**Wi‑Fi / Cell (uses network or optional API endpoints)**
- landing.html (OAuth / auth session)
- field-checkin (register / heartbeat / server sync)
- wishlist (optional submit endpoint)
- support (submit tickets)
- authority-assistant (optionally posts to `/api/support/ticket`)
- outdoor-kit (integrations and optional AI/chat endpoints)
- privacy-camera (media upload / sync endpoint)
- privacy-recorder (media upload / sync endpoint)
- audio-notes (media upload / sync endpoint)
- image-rater (fetches images and optional caption/tag APIs)
- games/game-academy-v2 (fetches tags / chat endpoints)
- any app that exposes a "sync endpoint" or shows an `/api/` input field

Notes
- Many apps in the "Wi‑Fi / Cell" section include offline-first UX and local fallbacks; they will still function in a limited capacity when offline but provide extra features when a server is available.
- The Go server exposes optional API endpoints when started with `--enable-api` (see `prosepilot.go`). These are: `/api/pulse`, `/api/media/upload`, `/api/register`, `/api/heartbeat`, `/api/wishlist/submit`, `/api/support/ticket`, and several auth endpoints.
- If you'd like, I can:
  - update the launcher UI to present these categories in the sidebar
  - add a small badge for each app indicating "offline" or "online features"
  - generate a screenshot pack for selected apps for the README

If you'd like me to modify the launcher to surface these two categories, say "yes, modify launcher" and I'll patch the launcher UI next.
