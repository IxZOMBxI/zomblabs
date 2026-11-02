# Start here: ZombOS local handoff

ZombOS is Zomb Labs' static website presented as a retro CRT desktop after a simulated login/boot. Development is moving from cloud to an existing Windows checkout opened in Codex Desktop. Repository: `IxZOMBxI/zomblabs`; development: `zombos-preview`; production: `main`; website: https://zomblabs.com.

## Read order

1. **AGENTS.md** — permanent development and branch safety rules.
2. **LOCAL_DEVELOPMENT.md** — verify the real checkout, serve locally, test and use Git safely.
3. **PROJECT_CONTEXT.md** — current files, APIs, state, schemas and limitations.
4. **ROADMAP.md** — agreed future direction, not an instruction to build everything.
5. Relevant `docs/settings.md`, `docs/virtual-filesystem.md`, `docs/zombnet.md`, `docs/arcade.md`, and `media/README.md`; cross-check older documentation against current source.

## Existing implementation

The source includes desktop/Start/taskbar/window controls, Radio with persistent audio and artwork, read-only File Explorer, ZombNET internal pages and external HTTPS tabs, shared Arcade with DEAD SPRINT, Settings with five built-in palettes and an advanced custom editor, and original Social Network/signup applications. These are implemented systems, not proof of fresh end-to-end acceptance on your machine.

`js/desktop.js` composes apps and shared services; `app-registry.js` and `window-manager.js` own lifecycle. `script.js` owns original sequences/signup. Themes are `theme-schema.js`, `settings-state.js`, `theme-editor.js`, `themes.css` and `windows.css`. Radio service and catalog loader are independent of its window. Use existing VFS/network registries; do not duplicate architecture. There is no framework/build step.

## Important handoff findings

- Audited base: `bf75d068bd8472f82c15be1f516f18f49a946af0`, matching fetched preview at handoff. The documentation commit comes after that base.
- **Catalog is stale:** committed JSON references two removed development WAV tones. Real files exist: 10 MP3 songs, 10 matching PNGs, 3 MP3 broadcasts. A read-only generator scan found all of them and all music covers. No media/catalog changes were made in this docs-only handoff. Reconcile and browser-test in a separately authorized task.
- **One custom theme slot exists. Multiple saved custom presets do not.** Preserve that saved custom theme when designing a collection/migration. Export/save UI must not erase user presets.
- **Workflow targets production:** `media-library.yml` always checks out/pushes main and requests a Pages build. Never manually dispatch it to test preview. Live Pages configuration and delivery remain unverified.
- Browser test harnesses from cloud are not committed. Existing checks are five Node test files and two Python unittest methods; all passed in handoff, as did JS syntax. No new browser/live-service tests ran for the documentation change.

## Safe next session

Confirm local directory, remote, branch, status and fetched history before editing. The old `O:\Zomb Labs - Site\media` path was a media source, not a guaranteed checkout. Read the actual current code; do not recreate previous milestones or assume cloud paths/tools exist on Windows. Serve locally with Python, use Node for tests, and verify real media playback and desktop/mobile behavior.

Next planned work is theme polish and multiple saved custom presets after baseline verification; catalog reconciliation is an immediate identified maintenance need. Terminal and wider Explorer/ZombNET/discovery/Arcade expansions remain future scoped work. No lore or placeholder content is authorized by this handoff.

Preserve design, boot, apps, original assets and backward-compatible storage. Keep changes narrow. Do not auto-commit/push unless the current task explicitly requests it. Never merge main or deploy without approval. This handoff task authorized only new documentation and a preview commit/push.
