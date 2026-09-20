# Greytrace future direction

Recorded: 2026-09-20.

Status: direction agreed in planning; implementation is deferred. This document
does not mean Cloudflare migration, desktop retirement, or gameplay changes have
already shipped. Use it as context when resuming the work.

## Product intent and reasons

Make Greytrace a web-only tactical shooting/practice game with a polished core
and PUBG-inspired feel. An Aimlabs-style alternative is a possible direction,
not a commitment to reproduce Aimlabs' entire feature set or precisely simulate
PUBG mechanics.

The owner plans to promote the project through personal branding. A shareable
link and an easy first session should support that effort. There is little
adoption today: the owner reports fewer than ten desktop users and installation
friction from unsigned builds. Maintaining desktop distribution has limited
payoff at this stage.

The priority is to make the existing shooter feel right, rather than expand
every system. Asset reduction and performance optimization are part of this
direction. The owner is open to changing technology when justified, but a full
engine/framework rewrite is not a prerequisite.

## Hosting direction

- Move web hosting from Vercel to Cloudflare before broader promotion.
- Start by evaluating Workers Static Assets for the existing Vite build.
- Use R2 if independently managed or larger assets justify it; it is optional,
  not a required extra service from day one.
- Keep React, TypeScript, Three.js/react-three-fiber, Vite, and pnpm unless
  profiling or a concrete requirement demonstrates a reason to change them.
- Verify current provider limits and pricing at implementation time. Cloudflare
  improves the delivery setup, but cannot guarantee freedom from future scaling
  issues or solve client-side download, memory, and rendering costs.
- Validate a Cloudflare preview, asset loading, domain setup, caching, and a
  rollback path before switching production away from Vercel.
- If assets move to R2, version their URLs and keep assets needed by retained
  builds. Exclude externally hosted assets from the web deployment output.

References: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/),
[static asset billing and limits](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/).

## Web-only distribution

- Retire Electron installers, desktop update flows, and desktop release jobs
  when the web transition is ready. Preserve the last desktop release and source
  history for reference.
- Keep normal local development and production web builds. "Web-only" refers to
  distribution, not removing the ability to develop and test locally.
- Initial proposed audience: desktop browsers with mouse and keyboard. Mobile
  gameplay is not implied; confirm the supported browser/device matrix before
  implementation. Mobile visitors could see a demo and desktop-play guidance.
- Test pointer lock and recovery, mouse sensitivity, fullscreen, audio startup,
  keyboard shortcuts, and frame stability in the supported browsers. Electron's
  controlled runtime and launch flags will no longer be available.
- Removing Electron reduces maintenance; it does not by itself remove the large
  models, textures, and audio already included in the web build.

## Core experience to validate

Working promise: "Open Greytrace. Play a satisfying five-minute tactical session."

Prioritize responsive aiming, movement, recoil, hit feedback, readable targets,
stable performance, and a quick retry loop. Add useful results and personal
progress only around a clear, repeatable challenge.

A candidate first scope is one compact arena, a small weapon selection, and
spray-control, tracking, or peek-and-shoot drills. These are proposals to select
from, not a requirement to build all three immediately. Confirm the first mode,
weapon set, and camera perspective before implementing a scope reduction.

Defer accounts, online multiplayer, global leaderboards, elaborate progression,
large cosmetic collections, and numerous maps/drills unless they become necessary
to validate the core. Avoid replacing shooter scope creep with trainer scope creep.

PUBG-inspired presentation is not a promise of exact training transfer. Claims
about matching its mechanics would require sensitivity/FOV calibration and
validation of ADS, recoil, and bullet behavior with players.

## Optimization and validation

- Measure cold-load time and actual transferred bytes, not just build size.
- Remove unused shipped assets, load only assets needed by the selected mode,
  and evaluate texture/model/audio compression with visual and gameplay checks.
- Profile frame time, stutters, and memory on representative hardware before
  deciding that a stack change is needed.
- Establish measurable budgets after taking a baseline; no download-size or FPS
  target has been agreed yet.
- During early promotion, measure time to first playable moment, session
  completion, retries, and return visits. Combine those signals with player
  feedback on feel and reasons to return.

## Suggested implementation order

1. Define the smallest core session and supported browsers/devices.
2. Establish and verify Cloudflare hosting, then switch production safely.
3. Retire desktop distribution and remove desktop-only product UI/tooling.
4. Reduce assets and polish the selected core using measured bottlenecks.
5. Share with a small group of players, observe sessions, and iterate before
   expanding scope.

The Vercel storage cleanup and initial asset optimization precede this plan.
Their completion should not be confused with completion of this future work.
