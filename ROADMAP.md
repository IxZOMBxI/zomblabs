# ZombOS roadmap

This records direction, not authorization to implement every item. Select a scoped task with the owner before development. Source status is based on the handoff audit described in PROJECT_CONTEXT.md; browser acceptance still needs local verification.

## Implemented baseline to verify locally

| System | Current implementation | Outstanding verification / gaps |
| --- | --- | --- |
| Desktop | Boot, icons, Start, taskbar/status/clock, clean initial workspace | Desktop/mobile input and layout regression |
| Windows | Drag/resize/focus/overlap/minimize/maximize/restore/close | Small viewports, scrolling, focus and disposal |
| Radio | Persistent service, controls, artwork, spectrum, generated catalog | **Committed catalog is stale**; real assets need catalog reconciliation and browser playback checks |
| File Explorer | Read-only VFS, navigation, views, previews, synced apps/media, hidden preference | Media projection depends on catalog; further file interactions are future work |
| ZombNET | Internal pages, safe external tabs, bookmarks/history | Home/Radio/Arcade only; future sites require approved content |
| Arcade | Shared app/page and DEAD SPRINT, best scores | Device/playability/performance polish; no additional games promised |
| Advanced Theme Editor | Five presets, semantic controls, live preview, apply/cancel/reset/import/export | Coverage/contrast/mobile polish and schema migration planning |
| Custom saved presets | One named custom theme slot | **Multiple saved custom presets are not implemented** |

## Upcoming priorities

First reconcile the catalog with existing assets in a separately authorized change: generate it, inspect the 10 music/3 broadcast entries and matching covers, then browser-test playback. Do not reintroduce removed development tones or overwrite originals.

1. **Theme verification and multiple saved presets.** Audit all app/window/menu states, media color exclusions and mobile controls. Design a versioned collection with stable preset IDs, explicit save/update semantics and import validation. Migrate the existing custom slot losslessly; do not overwrite user-created presets. Test corrupt/old storage and storage denial.
2. **Interactive Terminal.** Integrate commands with the existing virtual filesystem and application launch APIs. Define supported read-only commands and keyboard accessibility before coding. No real shell/filesystem access, fabricated lore or duplicate filesystem.
3. **Explorer expansion.** Build on existing text/image/Properties viewers and navigation. Add only useful supported types/actions, genuine content and metadata; keep unsupported destructive operations disabled.
4. **ZombNET expansion.** Extend the registry with approved fictional sites, layouts and meaningful navigation. Preserve public/hidden/unlisted/locked distinctions and safe external HTTPS behavior. Do not invent canon or fake news to fill pages.
5. **Arcade improvements.** Improve DEAD SPRINT usability, feedback, mobile input and performance, then scope additional original games separately. Keep score compatibility and lifecycle cleanup.
6. **Shared discovery/unlocks.** Unify currently separate in-memory hooks across VFS, ZombNET and Arcade with a small versioned event/state interface. Define persistence/reset semantics before content. No complex quest system yet; hidden public content never holds secrets.
7. **Settings expansion.** Add useful categories through existing composition. Keep persistence/schema/UI separated; implement only agreed controls.
8. **Desktop/mobile/performance.** Improve accessibility, compact layouts, touch interaction, rendering/resource disposal and media loading based on measured problems. Preserve original media unless asset optimization is specifically approved.

## Long-term direction

Integrate Zomb Labs releases/products into the desktop: original software, music, games and hardware. Expand an approved fictional universe through interconnected experiences as real content becomes available. A fictional map is very low priority and should wait for substantial established lore. None of these long-term ideas is currently a completed system or an instruction to create placeholder content.
