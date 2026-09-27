# GreyTrace

GreyTrace is a web tactical shooting prototype built with React and Three.js.
The current public-facing target is **Beta Build 0.3.0**.

**[Play Greytrace in your browser](https://greytrace.lowhp.studio)**

This beta focuses on the core playable loop: a cinematic lobby, selectable
operators, practice maps, gun handling, and settings.
It is still not a full live-service game: there is no backend progression,
matchmaking, or account system yet. A web version is deployed on Vercel.

## Planned Direction

The planned direction is Cloudflare hosting, web-only distribution, and a focused
tactical shooting/practice experience. Desktop packaging and auto-updates have been removed. Cloudflare migration and gameplay changes are still planned.
See [future plans](docs/FUTURE-PLANS.md) for the reasons, tradeoffs, proposed scope,
and implementation order, and [the roadmap](docs/ROADMAP.md) for earlier backlog context.

## Current Beta Scope

- Boot-to-lobby character reveal
- Noir lobby stage with centered operator preview
- Play panel with selectable **Range** and **TDM** practice maps
- Unlocked operator collection
- Practice shooting, movement, recoil, hit feedback, and reset flow
- Settings for gameplay, controls, audio, graphics, and HUD

## Tech Stack

- React 19 + TypeScript
- Vite for the web build/dev server
- Three.js with `@react-three/fiber` and `@react-three/drei`
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

The Vite dev server uses port `1420`.

## Verification

```bash
pnpm typecheck
pnpm build
pnpm lint
pnpm audit --audit-level moderate
```

There are no automated gameplay tests yet, so visual and browser smoke testing
are still required before shipping a build.

## Web build

```bash
pnpm build
pnpm preview
```

The production website is generated in `dist/`. Existing Vercel hosting remains
in place until the separate Cloudflare migration. GitHub Actions validates lint
and the web build; it no longer publishes desktop installers.

Historical desktop releases remain available on GitHub. New desktop installers
and automatic desktop updates are no longer produced.

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
- `src/game/SettingsPanels.tsx` - settings panels
- `src/screens/LoadingScreen.tsx` - loading experience
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
