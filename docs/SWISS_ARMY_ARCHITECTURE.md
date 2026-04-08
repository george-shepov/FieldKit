# FieldKit "Last App Standing" Architecture

## North Star

Build a resilient, offline-first toolkit that still provides value if:

- internet is unavailable,
- power/network reliability is poor,
- user is in travel, field, or emergency conditions.

The product should behave like a digital Swiss army knife:

1. Essential survival/utility tools
2. Communication fallbacks
3. Learning + practice engine
4. Physical readiness + wellness
5. Lightweight entertainment

## Product Layers

### Layer 1: Runtime and Packaging

- Desktop launcher (Go single binary) for Linux/Windows/macOS
- Local web UI served from embedded assets
- Optional LAN share mode (`--share`) for phone/tablet access
- PWA mode for phone offline install
- Optional API mode (`--enable-api`) for pulse, media sync, registration, heartbeat, and lightweight chat

### Layer 2: Core Capabilities (always available)

- Local storage abstraction (settings, user profile, histories)
- Unified help system (`F1` + full help pages)
- Data export/import (JSON bundle)
- Health check dashboard (sensor/API availability)

### Layer 3: Domain Modules

#### Navigation

- Compass
- GPS speed/altitude
- Sun navigation (position by time/location)
- Star map (phase 1: sensor-based sky map; phase 2: camera recognition)

#### Measuring

- Distance between two map points (GPS/map tap)
- Approximate volume calculators (container templates)
- Approximate weight estimator (density-based presets)

#### Communication

- Light Messenger (Morse flash TX/RX)
- Online Messenger (when internet is available)
- Pager/short burst mode for constrained comms
- Field Check-In (device registration + emergency contact + heartbeat)
- Support Desk (structured ticket intake with offline queue + online submit)

#### Education

- Existing trainers (Linux, JS, Driver License)
- Content ingestion pipeline (PDF/link to flashcards + scenarios)
- Spaced repetition and competency scoring
- Wishlist Studio for customer-request intake and fast custom module quoting

#### Physical

- CNS Tap Test + progressive resistance recommendation
- Calisthenics plans (Convict Conditioning style tracks)
- Yoga routines
- Meal tracker + travel cookbook

#### Entertainment

- Existing games and cognitive drills
- Additional small games from `games/` folder

## Offline Tiers

### Tier A (no network, no sensors)

- Flashcards, study decks, trainers
- CNS tap test, exercise plans
- Most games
- Static survival references

### Tier B (no network, sensors available)

- Compass / speed / altitude
- Light messenger receive/transmit (camera + display/torch)

### Tier C (network available)

- Cloud sync (optional)
- Content ingestion jobs (PDF/link processing)
- Team collaboration and updates
- Device monitoring (stale heartbeat detection + escalation workflow)

## Cloud Companion (Optional but Recommended)

For production customer flow, run a small VPS endpoint:

- Hosts bundle over HTTPS for smooth phone install.
- Stores media uploaded from privacy camera/recorder.
- Receives registration payload (device + emergency contacts).
- Receives heartbeat pings for safety monitoring.
- Exposes pulse endpoint so clients can detect live connectivity.

This keeps every app autonomous offline, while still using network value when available.

## Content Ingestion Service (Education Engine)

Input:

- PDF/manual/documentation URL

Pipeline:

1. Extract text + structure (headings, lists, tables, code blocks)
2. Trim low-signal sections (boilerplate/water)
3. Build knowledge map (concept -> definition -> examples -> failure modes)
4. Generate:
- flashcards
- command questions
- scenario questions
- short concept summaries
5. Human QA pass (quick edit UI)
6. Export package for offline use

Output package format (draft):

- `deck.json`
- `scenarios.json`
- `concepts.json`
- `meta.json`

## Suggested Repository Layout

- `shared/` common runtime scripts + help data
- `help/` full help center
- `modules/` future structured domain modules (nav, measure, comms, fitness, edu)
- current app folders remain as-is until gradual migration
- `services/ingest/` future backend for document-to-deck pipeline

## Short-Term Execution Plan (Practical)

### Phase 1 (now)

- Stabilize launcher and help (done)
- Add Off-Grid Essentials app shell (compass + speed/altitude + SOS beacon)
- Expand Driver License content volume (target 200+ cards/questions)
- Import selected games from `games/` into launcher

### Phase 2

- Education ingestion MVP (manual upload -> generated deck)
- Scenario trainer format shared across Linux/JS/driver docs
- User profile + readiness dashboard

### Phase 3

- PWA offline install polish
- Optional .NET/Blazor frontend modules (where maintainability benefits)
- Native wrapper path for robust torch/camera/sensors if needed

## Technology Strategy (Go + optional Blazor)

Recommended hybrid:

- Keep Go launcher for simple distribution and zero dependencies.
- Keep HTML/JS modules for fast delivery of sensor-heavy features.
- Add Blazor WebAssembly for modules where C# domain logic is advantageous (education engine UI, complex planners, analytics).
- Use JS interop for camera/torch/orientation even in Blazor modules.

This avoids a risky rewrite while leveraging your .NET strengths.

## Product Positioning

"Your offline-ready productivity and survival operating kit: learn, navigate, communicate, train, and recover from one small local app bundle."
