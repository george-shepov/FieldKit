# FieldKit Desktop Launcher (Go)

This project includes a compiled launcher executable that serves the suite locally with no Python/Node dependency.

## Run locally (developer)

```bash
go run .
```

Flags:

- `--port 8787` change port
- `--share` bind to `0.0.0.0` and print a phone URL (same Wi-Fi)
- `--no-browser` do not auto-open browser
- `--open /linux-trainer/index.html` open a specific app path
- `--enable-api` enable built-in backend endpoints:
  - `/api/pulse`
  - `/api/media/upload`
  - `/api/register`
  - `/api/heartbeat`
  - `/api/chat/send`, `/api/chat/poll`
  - `/api/wishlist/submit`
  - `/api/support/ticket`
- `--data-dir ./data` choose storage location for uploads/metadata
- `--api-key YOUR_TOKEN` protect upload/register/heartbeat/chat endpoints

Example:

```bash
go run . --share --port 8080
```

API-enabled example:

```bash
go run . --share --enable-api --api-key "replace-me"
```

### Optional control menu CLI

Use the helper CLI to avoid remembering long commands:

```bash
./scripts/suite-cli.sh
```

On Linux, `suite-cli` now uses service mode by default for stability.
Set `SUITE_CLI_USE_SERVICE=0` if you need direct/background process mode.

Direct commands:

```bash
./scripts/suite-cli.sh start lan-api
./scripts/suite-cli.sh status
./scripts/suite-cli.sh restart
./scripts/suite-cli.sh stop
./scripts/suite-cli.sh rebuild
```

### Persistent launcher (recommended on Linux)

If background shell launch is unstable on your machine, run as a user `systemd` service:

```bash
./scripts/suite-service.sh install
./scripts/suite-service.sh start
./scripts/suite-service.sh status
```

Useful service commands:

```bash
./scripts/suite-service.sh restart
./scripts/suite-service.sh logs
./scripts/suite-service.sh stop
```

## Build binaries on Linux/macOS

```bash
./scripts/build-release.sh
```

Artifacts are written to `dist/`:

- `prosepilot-linux-amd64`
- `prosepilot-linux-arm64`
- `prosepilot-windows-amd64.exe`
- `prosepilot-windows-arm64.exe`
- `prosepilot-darwin-amd64`
- `prosepilot-darwin-arm64`

## Build customer upload bundles

After build, create per-platform ZIP bundles with quick-start scripts and README:

```bash
./scripts/package-release.sh
```

Output is written to `dist/packages/`:

- `prosepilot-<version>-linux-amd64.zip`
- `prosepilot-<version>-windows-amd64.zip`
- and other target variants

Bundle manifest:

- `dist/packages/manifest-<version>.txt`

## Build binaries on Windows

```powershell
./scripts/build-release.ps1
```

Optional Windows-side packaging:

```powershell
./scripts/package-release.ps1
```

## Customer usage

Desktop-only (private localhost):

```bash
prosepilot
```

Desktop + phone on same network:

```bash
prosepilot --share
```

Desktop + phone + sync/check-in API:

```bash
prosepilot --share --enable-api --api-key "replace-me"
```

## VPS hosting mode

Run on VPS and expose behind HTTPS (Caddy/Nginx):

```bash
./prosepilot-linux-amd64 --host 0.0.0.0 --port 8787 --enable-api --data-dir ./data --api-key "replace-me" --no-browser
```

Phone install flow:

1. User opens `https://your-domain`.
2. User adds to Home Screen (PWA-style install).
3. User opens `Field Check-In` app, enters emergency contact, taps `Send Registration`.
4. `Privacy Camera` / `Privacy Recorder` default sync endpoint becomes `https://your-domain/api/media/upload`.

## Sales funnel tie-in (Gumroad/Store)

Recommended path:

1. Buyer completes payment on Gumroad/Stripe storefront.
2. Redirect buyer to your hosted suite URL with onboarding instructions.
3. First-run in `Field Check-In` captures:
   - device ID
   - app version
   - emergency contact (optional + consent)
4. Periodic heartbeat updates are sent to `/api/heartbeat`.
5. Monitoring job checks stale heartbeats and can trigger manual outreach.

## Notes

- `--share` is LAN-only. Do not expose the port to the public internet.
- Camera/torch browser APIs may require HTTPS or localhost secure context depending on feature and device.
- If you expose to public internet, place behind HTTPS and set a strong `--api-key`.
