# FieldKit Customer Quickstart

This guide is for end users who downloaded a FieldKit bundle.

## 1) Choose Your File

Download the ZIP matching your system:

1. Windows (most users): `windows-amd64`
2. Linux desktop (most users): `linux-amd64`
3. ARM devices: `*-arm64`
4. macOS Intel/Apple Silicon: `darwin-amd64` / `darwin-arm64`

## 2) Extract Package

Unzip the downloaded file into any folder.

The folder includes:

1. launcher binary (`prosepilot` or `prosepilot.exe`)
2. `run-local` script
3. `run-lan` script
4. `README.txt`

## 3) Start The App

Desktop only:

1. Run `run-local` (`.bat` on Windows, `.sh` on Linux/macOS)

Desktop + phone on same Wi-Fi:

1. Run `run-lan`
2. Open the printed phone URL on your mobile browser

## 4) First-Run Checklist

1. Open launcher home page
2. Press `F1` to view suite help
3. Open any app and press `F1` again for app-specific help
4. Confirm your browser camera/microphone permissions if using capture tools

## 5) Recommended Setup

For field/safety workflows:

1. Open `Field Check-In`
2. Enter device details and emergency contact (optional)
3. Save settings and send registration when online

For support/feedback:

1. Open `Support Desk` for bug reports
2. Open `Wishlist Studio` for feature requests

## 6) Optional Online API Mode

If your launcher is started with API enabled, apps can sync/submit data.

Example run:

```bash
./prosepilot --enable-api --api-key "<strong-random-key>"
```

Useful endpoints:

1. `/api/pulse`
2. `/api/media/upload`
3. `/api/register`
4. `/api/heartbeat`
5. `/api/wishlist/submit`
6. `/api/support/ticket`

## 7) Common Tasks

### Open on phone from desktop

1. Run with LAN sharing mode (`run-lan`)
2. Keep phone and desktop on same network
3. Enter printed phone URL in browser
4. Note: iPhone compass/orientation APIs are blocked on plain `http://192.168.x.x` and require `https://` (or `localhost`)

### Use offline mode

1. Open suite once while online so pages/assets are cached
2. Add to Home Screen from browser menu
3. For true phone offline install, use HTTPS origin (VPS/domain); plain `http://192.168.x.x` LAN mode cannot register service worker on most phones
4. Sync/submit later when online (where supported)

### iPhone Compass + HTTPS Setup (VPS)

1. Provision a VPS you control and point your domain/subdomain DNS to it (example: `suite.yourdomain.com`)
2. Copy your bundle to VPS (launcher binary + app folders)
3. Run launcher on localhost only: `./prosepilot --host 127.0.0.1 --port 8787`
4. Put Caddy or Nginx in front and terminate TLS on `443`, reverse-proxy to `127.0.0.1:8787`
5. Open `https://suite.yourdomain.com` on iPhone, then Share -> Add to Home Screen
6. Verify in Safari address bar that lock icon is present before testing compass/GPS

### Capture media and sync later

1. Use Privacy Camera / Privacy Recorder / Audio Notes
2. Save sync endpoint settings
3. Trigger sync when connection returns

## 8) Troubleshooting

### App won’t open in browser

1. Confirm launcher process is running
2. Use the printed Desktop URL
3. Check local firewall rules
4. Linux only (if launch keeps stopping): use service mode

```bash
./scripts/suite-service.sh install
./scripts/suite-service.sh restart
```

### Phone cannot connect

1. Confirm same Wi-Fi network
2. Use `run-lan` mode
3. Disable VPN on phone/desktop if needed
4. Confirm host firewall allows selected port

### Camera or microphone fails

1. Allow browser permission prompts
2. Retry in a modern browser
3. Use HTTPS/localhost contexts for stricter devices

### Compass says "only localhost or HTTPS"

1. This is expected browser security behavior on iOS
2. Use `https://` URL (recommended via VPS reverse proxy)
3. Or test on same device with `localhost` development setup

### Sync fails

1. Verify endpoint URL
2. Verify API key value
3. Check endpoint CORS and server logs
4. Retry from app sync controls

## 9) Privacy Notes

1. Some modules keep media in tab memory until explicit action
2. Browser/OS can still use temporary internal buffers while devices are active
3. Only sync to endpoints you control/trust

## 10) Support

Use in-app `Support Desk` first for fastest triage.

When reporting issues, include:

1. App name
2. Steps to reproduce
3. Expected vs actual behavior
4. Device/browser info
