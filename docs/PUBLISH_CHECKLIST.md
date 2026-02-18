# ProSe Pilot Publish Checklist

Use this checklist to ship a release quickly to Gumroad and/or oneof.store.

## 1) Release Prep (Before Upload)

- [ ] Build binaries: `./scripts/build-release.sh`
- [ ] Package customer bundles: `./scripts/package-release.sh`
- [ ] Confirm bundles exist in `dist/packages/`
- [ ] Smoke test one Linux build and one Windows build
- [ ] Verify launcher opens and F1 help works
- [ ] Verify API mode starts: `--enable-api --api-key "change-me"`
- [ ] Update version/date in product page copy

## 2) Files To Upload

Primary customer files:

1. `prosepilot-<version>-windows-amd64.zip`
2. `prosepilot-<version>-linux-amd64.zip`
3. Optional ARM variants (`windows-arm64`, `linux-arm64`)
4. Optional macOS variants (`darwin-amd64`, `darwin-arm64`)

Internal tracking file:

1. `manifest-<version>.txt`

## 3) Gumroad Setup

1. Create product: `ProSe Pilot (Offline Productivity + Survival Toolkit)`
2. Product type: digital product with downloadable files
3. Upload ZIP files for each platform
4. Add pricing tiers:
   - Base bundle
   - Bundle + priority support
   - Bundle + custom app credit
5. Add post-purchase redirect URL (oneof.store onboarding page)
6. Add receipt email text with quick-start instructions

## 4) oneof.store Setup

1. Add product card with same version name as Gumroad
2. Add platform matrix (Windows/Linux/ARM/Mac)
3. Add onboarding page section:
   - first run
   - `--share` mode
   - `--enable-api` mode
4. Add registration CTA: open `Field Check-In` app
5. Add support CTA: open `Support Desk` app

## 5) Product Page Copy (Template)

Short description:

`Offline-first app suite for productivity, learning, field navigation, communication fallback, and emergency-ready utilities. Works locally without cloud; uses online sync/API when available.`

Value bullets:

1. Works offline first; cloud is optional
2. Single launcher, many autonomous apps
3. Built-in F1 help in launcher and each app
4. Privacy camera/recorder with queued sync
5. Field check-in, heartbeat, wishlist, and support desk

Who it is for:

1. Off-grid travelers and field teams
2. Learners who want local study tools
3. Users who need resilient local software

## 6) Pricing Template

Suggested baseline:

1. Base Bundle: `$49-$99`
2. Bundle + Priority Support: `$149-$249`
3. Bundle + Custom App Sprint Credit: `$750`

Custom work framing:

1. Micro tweak: `$99-$250`
2. Focused app (2-7 days): `$450-$900`
3. Module build (backend + rollout): `$1200+`

## 7) Post-Purchase Message Template

Subject:

`Your ProSe Pilot Download + Quick Start`

Body:

`Thanks for your purchase.`

`1) Download the ZIP for your platform.`

`2) Extract and run run-local (or run-lan for phone access).`

`3) Press F1 in launcher for full app help.`

`4) For online sync, run with --enable-api and set your API key.`

`5) Open Field Check-In to register device + emergency contact.`

`6) Open Support Desk if you need help or want to report a bug.`

## 8) Launch Day QA

- [ ] Download flow works from storefront
- [ ] ZIP extracts cleanly on Windows and Linux
- [ ] `run-local` starts app
- [ ] `run-lan` prints phone URL
- [ ] `--enable-api` endpoints respond
- [ ] Wishlist submit works
- [ ] Support ticket submit works
- [ ] Privacy camera/recorder sync endpoint works

## 9) Support SLA Template

1. Initial response: within 24 hours (business days)
2. Critical bug triage: same day
3. Minor bug triage: 2-3 days
4. Custom app estimate: 1 business day

## 10) Weekly Release Rhythm

1. Monday: collect tickets + wishlist
2. Tuesday-Wednesday: implement fixes/features
3. Thursday: QA + package
4. Friday: publish + customer update
