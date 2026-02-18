# Outdoor / Off-Grid Product Roadmap

This document turns your idea into an implementation path with realistic browser constraints.

## Product direction

Position ProSe Pilot as a compact offline utility pack:

1. Productivity + training apps (already done)
2. Off-grid communication tools
3. Outdoor navigation and survival helpers

## Priority 1: Light Signal Messenger (Phone-to-phone)

### Goal
Send short text between phones using light pulses and camera decoding when there is no cellular/data.

### Reality check
- Browser camera access usually needs secure context (`https://` or `localhost`).
- Torch/flashlight control is device/browser dependent (often Android Chrome only).
- For broad reliability, transmit via **screen flash** first, and use LED torch when available.

### Protocol (MVP)

- Character set: `A-Z`, `0-9`, space, `.`, `,`, `?`, `!`
- Encode text to Morse symbols (`.` and `-`)
- Timing unit: `U = 120ms` (configurable)
- Dot = `1U on`, Dash = `3U on`
- Intra-symbol gap = `1U off`
- Letter gap = `3U off`
- Word gap = `7U off`

Frame format:

1. Preamble: alternating flash for sync (`101010...` for `16U`)
2. Start marker: `-.-.-` (reserved)
3. Payload Morse sequence
4. End marker: `...-.-` (SK / end of contact)
5. CRC-8 checksum in Morse (hex)

Error handling:

- Repeat entire frame `3` times
- Receiver majority-votes each character across repeats
- If CRC fails, show `RETRY` prompt

### UX

Transmitter:
- Input box + quick preset chips (`SOS`, `Need help`, `I see you`, `Hold position`)
- Start/Stop transmit
- Speed slider (slow/medium/fast)

Receiver:
- Camera preview with bright-region detector
- Auto-calibration button
- Live decoded text + confidence meter

## Priority 2: Outdoor Essentials

1. Compass
- Uses DeviceOrientation API
- Fallback notice when sensor not supported

2. Speedometer + Altimeter
- GPS speed and altitude from Geolocation API
- Smoothing for noisy measurements

3. SOS beacon
- One-tap standard SOS strobe pattern

4. Emergency cards
- Offline medical/profile notes + QR

## Priority 3: Star Navigation

### MVP
- Offline star catalog subset (bright stars + constellations)
- Use GPS + time + compass + gyroscope to render sky map
- Let user align phone to cardinal reference points

### Future
- Camera-based star recognition (harder)
- Requires image processing and robust calibration

## Packaging recommendation

For best offline capability on phone:

1. Keep Go desktop launcher for desktop/LAN use.
2. Add PWA install mode for phone (cache all assets for airplane mode).
3. For camera/torch-heavy features, consider a thin native wrapper later (Android first) for better sensor permissions and reliability.

## Suggested build order

1. Ship Go launcher binaries (now)
2. Build Light Messenger MVP (screen flash TX + camera RX)
3. Add Compass + Speed/Altitude + SOS
4. Add PWA offline install flow
5. Iterate on star navigation
