# ProSe Pilot — Offline PWA Suite

An offline-first Progressive Web App (PWA) collection served by a compact Go HTTP server — curated productivity tools, learning utilities, and small games bundled into a single embeddable binary.

## App categories
See [APPS_CATEGORIES.md](APPS_CATEGORIES.md) for a grouped list of apps under "Airplane mode" and "Wi‑Fi / Cell" (network-required).

## Quick start

Requirements:
- Go 1.22+
- (optional) Node.js + npm for Playwright tests

Run development server:

```bash
go run .
```

Installable from GitHub (recommended workflow)

After you replace `USERNAME` with your GitHub username in `go.mod` and push a tag/release, users can install the CLI/server with:

```bash
go install github.com/USERNAME/prosepilot-launcher@latest
```

Replace `USERNAME` with your GitHub account name before publishing a release.

---

If you want, I can now update the launcher UI to surface these categories and add small offline/online badges to each app tile. Say "update launcher" to proceed.
