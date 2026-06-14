# GreyTrace

GreyTrace is a desktop FPS prototype built with React, Three.js, and Electron.
The current public-facing target is **Beta Build 0.3.0**.

This beta focuses on the core playable loop: a cinematic lobby, selectable
operators, practice maps, gun handling, settings, and desktop update support.
It is still not a full live-service game: there is no backend progression,
matchmaking, account system, or online deployment yet.

## Current Beta Scope

- Boot-to-lobby character reveal
- Noir lobby stage with centered operator preview
- Play panel with selectable **Range** and **TDM** practice maps
- Unlocked operator collection
- Practice shooting, movement, recoil, hit feedback, and reset flow
- Settings for gameplay, controls, audio, graphics, HUD, and updates
- Electron packaging for macOS, Windows, and Linux
- GitHub Releases update channel

## Tech Stack

- React 19 + TypeScript
- Vite for the web build/dev server
- Three.js with `@react-three/fiber` and `@react-three/drei`
- Electron for desktop packaging
- `electron-updater` for release update checks
- pnpm for dependency management

## Requirements

- Node.js 20+
- pnpm 10+

## Setup

```bash
pnpm install
```

## Development

Run the web lobby/game in Vite:

```bash
pnpm dev
```

Run the desktop Electron app during development:

```bash
pnpm app
```

The Vite dev server uses port `1420`.

## Verification

```bash
pnpm typecheck
pnpm build
pnpm lint
pnpm audit --audit-level moderate
```

There are no automated gameplay tests yet, so visual and desktop smoke testing
are still required before shipping a build.

## Packaging

```bash
pnpm build:electron
pnpm build:mac
pnpm build:win
pnpm build:linux
```

Packaged builds are written to `release/`.

## Updates

GreyTrace uses GitHub Releases for update metadata:

https://github.com/Low-HP-Studios/greytrace/releases

macOS auto-update can fail while the app is unsigned. Until a signing
certificate is configured, macOS users should install updates manually from the
GitHub Releases page. Windows and Linux update behavior still depends on the
release artifacts produced by `electron-builder`.

## Controls

- Move: `WASD`
- Sprint: `Shift`
- Jump: `Space`
- Shoot: left mouse button
- Aim/look: mouse
- Pick up weapon: `F`
- Drop weapon: `G`
- Reset targets: `R`
- Performance HUD: `P`

Controls can be adjusted from the in-game settings.

## Project Layout

- `src/App.tsx` - app screen flow and boot handoff
- `src/game/GameRoot.tsx` - main lobby/game state and overlays
- `src/game/scene/` - Three.js scene, runtime, camera, and lobby/game presentation
- `src/game/ExperienceMenuOverlay.tsx` - lobby tabs and UI surfaces
- `src/game/SettingsPanels.tsx` - settings and updater panels
- `src/screens/LoadingScreen.tsx` - loading experience
- `electron/` - Electron main process, preload bridge, and updater integration
- `public/assets/` - models, animations, audio, and static assets

## Dependency Safety

Dependencies are managed with `pnpm-lock.yaml` and should be checked before
Beta releases with:

```bash
pnpm audit --audit-level moderate
pnpm outdated
```

An audit cannot prove that a project is completely "virus-free," but it does
check installed dependency versions against known security advisories. Keep the
lockfile committed after dependency updates so every build resolves the same
package graph.
