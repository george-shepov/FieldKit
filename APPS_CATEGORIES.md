# App Categories

This document groups FieldKit applications and linked ecosystem apps by connectivity requirements.

## Airplane mode (fully offline / core functionality works without a network)

- accent-speaker
- acronym-list
- battleship
- clock
- docketpro
- drivers-license
- employee-skills
- games/game-academy (Chess & Checkers)
- games/reversi (Reversi / Othello)
- games/* (many games offline: Tic-Tac-Toe, Snake, Battleship, Positive IQ Test, Math Raindrops, Pattern Mirror, Odd One Out, etc.)
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

## Wi-Fi / Cell or separately installed PWA

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
- Vocabulary Expander — independent GitHub Pages/PWA application linked from the Training Lab
- Developer Interview Prep — independent GitHub Pages/PWA application linked from the Training Lab
- games/game-academy-v2 (variant with Ollama AI integration, requires local Ollama server)
- any app that exposes a "sync endpoint" or shows an `/api/` input field

## Ecosystem-app rule

Vocabulary Expander and Developer Interview Prep are catalog entries, not copied or merged FieldKit modules. Each application owns its repository, storage, service worker, tests, and release cycle. FieldKit provides discovery and navigation.

A linked app may work offline after it has been opened or installed according to that app's own PWA behavior. FieldKit's service worker does not take ownership of another application's cache.

## Notes

- Many apps in the "Wi‑Fi / Cell" section include offline-first UX and local fallbacks; they may still function in a limited capacity when offline.
- The Go server exposes optional API endpoints when started with `--enable-api` (see `fieldkit.go`). These are: `/api/pulse`, `/api/media/upload`, `/api/register`, `/api/heartbeat`, `/api/wishlist/submit`, `/api/support/ticket`, and several auth endpoints.
