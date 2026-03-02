# Process

## Goal of This Repo

Ship small, stable increments for a performance/feel test prototype.
Prioritize playable behavior over feature breadth.

## Change Workflow (Recommended)

1. Reproduce / define the problem clearly
2. Change one system at a time
3. Run checks (`pnpm lint`, `pnpm build`)
4. Smoke test `pnpm dev:web` and `pnpm dev` (Electron) when input/window/runtime behavior changes
5. Update docs (architecture/process/systems/decisions) if behavior changed
6. Commit in logical slices

## Commit Guidelines

- Keep commits scoped to one concern
- Prefer messages like:
  - `add jump and pause menu`
  - `convert FPS to TPS with visible character`
  - `fix bullet direction and camera lookAt offset`

## When to Add Documentation

Add/update docs when you change:

- Controls / input mappings
- Camera system behavior
- Runtime architecture / system ownership
- Asset pipeline or attribution rules
- Performance tooling / stress test methodology
- Window behavior (Electron settings, fullscreen defaults)
- Target system behavior (HP, respawn, damage values)

## Debugging Order (Pragmatic)

1. Input / pointer lock state
2. Camera positioning / lookAt direction
3. Frame loop timing
4. Collision / movement state
5. Weapon fire cadence / recoil
6. Shot direction / raycast hits
7. Audio state (WebAudio context, user gesture restrictions)
8. Render/perf counters

## Platform-Specific Notes

### Browser (Chrome/Firefox/Safari)

- Pointer Lock API works normally
- Click to lock, Esc to unlock (browser-managed)

### Electron (desktop)

- Pointer Lock API works natively via bundled Chromium
- FPS uncapped via `--disable-frame-rate-limit` and `--disable-gpu-vsync` flags
- F11 or Alt+Enter to toggle fullscreen

## Definition of Done (Prototype Feature)

- Behavior works in web dev (`pnpm dev`)
- Behavior works in Electron dev (`pnpm dev`) if desktop-related
- No TypeScript errors
- Lint passes (warnings allowed if intentional and documented)
- Docs updated if controls/architecture/process changed

## Trade-off Philosophy

We accept simple implementations early if they are easy to replace later.
We do not accept mysterious implementations, because future-us already has enough enemies.
