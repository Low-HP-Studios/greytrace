# Roadmap

## Current Focus

The 2026-09-20 direction is a web-only tactical shooting/practice game, Cloudflare
hosting, and a polished core with smaller assets. Implementation is deferred.
Read [Future Plans](FUTURE-PLANS.md) before choosing the next work; it captures the
owner's reasoning, tradeoffs, proposed scope, and implementation order.

## Earlier Roadmap (Historical Context)

The entries below preserve the prior desktop-focused roadmap. They are not a
fresh status audit or the current priority order; reassess them against the
future direction before implementation.

Stabilize TPS feel, camera, and Electron desktop experience for the practice prototype.

## Completed

- FPS to TPS conversion with visible character model
- PUBG-style over-the-shoulder camera
- Right-click ADS with smooth zoom
- Valorant-style jump physics (asymmetric gravity)
- Destructible targets with HP, HP bars, 2s respawn
- Movement direction bug fix (sine/cosine correction)
- Audio synth fallback gain fix (gunshot sound was silent)
- HUD visibility toggle from pause menu
- Migrated from Tauri to Electron (uncapped FPS, reliable pointer lock, GPU flags)
- Bullet trace direction fix (tracers go toward crosshair, not backward)

## Near-Term

- Add world occlusion checks for hitscan (no shooting through walls)
- Add score tracking + target timer drill mode
- Moving targets / varied HP targets
- Add proper web fullscreen button (user-gesture compliant)

## Mid-Term

- Swap placeholder audio with CC0 assets
- Swap placeholder character/gun/map with GLB models
- Add surface-based footsteps (concrete/grass)
- Add simple session metrics export
- Optional frame cap setting

## Long-Term (Only if prototype proves useful)

- Physics integration (`@react-three/rapier`) for richer interactions
- Modular weapon config system (rifle, smg, dmr presets)
- Replayable drills / presets

## Backlog Notes

Keep this practical. If a task doesn't improve feel, observability, or iteration speed, it probably belongs later.
