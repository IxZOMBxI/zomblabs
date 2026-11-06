# ZombOS technical context

## M13 update

Phone is implemented in `js/phone-*.js`, registered through the shared desktop
and window manager. `media/calls/` and recording sidecars feed the existing catalog
generator; calls are excluded from Radio and Explorer media projections. Phone
uses `zombos.phone.v1` for delivery state and history. See [docs/phone.md](docs/phone.md)
for the current schema, timing/outcome policies, Radio handoff and test commands.
The older audit below predates Phone and the now-populated real media catalog.

## Audit scope

Source audited at `bf75d068bd8472f82c15be1f516f18f49a946af0` on `zombos-preview`, 2026-11-02. Remote preview matched this base when fetched. This document describes implementation inspected in source, not a claim that every browser/device or live service was retested. See the verification section for checks actually run during handoff.

**Immediate verified issue:** the committed `media/library.json` lists two removed development WAV tones. Actual media contains 10 MP3 songs, 10 matching PNGs and 3 MP3 broadcasts. A read-only `generate(root)` scan produced 10 music entries, all with artwork, and 3 broadcasts. The catalog was deliberately not rewritten in this documentation-only task. Radio and Explorer consume the catalog, not a browser-side directory scan.

## Files and composition

This is a static website, with no bundler, package.json, framework or application backend. Python generates JSON offline. Node runs committed tests. No dependency installation/build step is required to serve it.

| Location | Responsibility |
| --- | --- |
| `index.html`, `script.js` | Login/loading/boot/welcome screens, desktop reveal, original social/signup DOM and form behavior |
| `style.css` | Original site, typography, screens and CRT presentation |
| `windows.css` | Desktop, windows, app layouts and custom theme selectors |
| `themes.css` | Five preset palettes, legacy tokens and semantic defaults |
| `js/desktop.js` | Registry/service composition, launch, installed shortcuts, taskbar/clock/Start, file previews |
| `js/app-registry.js`, `js/window-manager.js` | App definitions and reusable window lifecycle |
| `js/audio-service.js`, `js/media-catalog.js`, `js/radio-app.js` | Persistent playback, validated catalog loading, disposable player UI |
| `js/theme-schema.js`, `js/settings-state.js` | Early classic scripts: color schema, restoration, state and persistence |
| `js/settings-app.js`, `js/theme-editor.js` | Settings category composition and custom editor |
| `js/virtual-filesystem.js`, `js/filesystem-content.js`, `js/explorer-app.js` | Virtual paths/data, projection of apps/media, Explorer interface |
| `js/zombnet-network.js`, `js/zombnet-state.js`, `js/zombnet-app.js` | Page registry, saved browsing data, browser UI |
| `js/arcade.js`, `js/arcade-scores.js` | Shared Arcade UI/registry and high scores |
| `js/dead-sprint-engine.js`, `js/dead-sprint.js` | DEAD SPRINT simulation and canvas/input lifecycle |
| `tools/generate-media.py`, `tools/id3_artist.py` | Catalog scanner and embedded MP3 artist reader |
| `media/` | Original audio/artwork, optional sidecars, generated catalog, README |
| `tests/` | Node model/schema tests and Python ID3/generator tests |
| `docs/` | Settings, VFS, ZombNET and Arcade subsystem references |
| `.github/workflows/media-library.yml`, `CNAME` | Main-branch catalog/Pages automation and custom domain declaration |

`theme-schema.js` and `settings-state.js` run before styles for early restoration. Classic `script.js` handles the original sequences; module `desktop.js` constructs apps without automatically opening them. The workspace remains hidden until boot completes. This login is theatrical, not authentication/security.

Social Network and System Update move their original nodes out of hidden `#appStorage` into a window, then return them on disposal. This preserves existing form listeners and state. Signup uses `#emailForm` and the existing FormSubmit AJAX integration at `https://formsubmit.co/ajax/zomblabsmain@gmail.com`. Social destinations remain Kick `/zomblabs`, YouTube `@Zomblabs`, TikTok `@zomb.labs`. Do not clone/replace these panels without preserving behavior. Live delivery was not tested in this handoff.

## Apps, lifecycle and windows

`AppRegistry(windowManager)` exposes `apps` (Map), `register(app)` and `open(id)`. Definitions require `id`, `title`, `mount`; duplicate IDs throw. Dimension validation uses positive numbers, defaults 380×300/minimum 280×220 and ensures defaults are at least minimums. `open` returns the window ID.

| ID | Display name | Default width×height | Minimum |
| --- | --- | --- | --- |
| `radio` | Radio | 440×620 | 300×420 |
| `social` | Social Network | 440×420 | 300×280 |
| `updates` | System Update | 440×460 | 300×280 |
| `settings` | Settings | 520×560 | 300×280 |
| `explorer` | File Explorer | 660×460 | 320×300 |
| `zombnet` | ZombNET | 650×480 | 320×300 |
| `arcade` | ZombNET Arcade | 700×460 | 320×300 |
| `sample` | Sample | 380×300 | 280×220 |
| `file-view:…` | File name / Properties | 440×340 | 280×220 |

`desktop.js` keeps `instances` and `launch(id)`: existing windows focus/restore, otherwise registry opens one. Installed entries drive desktop buttons, Start menu and the VFS Desktop; Sample is added only to Start's development section. Pointer double-click opens desktop icons; keyboard activation and touch/pen click launch directly. Taskbar includes running windows, Radio status/reopen, Start and a clock.

`WindowManager(workspace, taskbar)` exposes `windows`, `place(state)`, `focus(id, keyboard=false)`, `open(app)`, `close(id)`. Minimize and maximize are implemented by the controls inside `open`, not public methods with those names. Map ordering manages stacking/focus. State stores geometry, minimums, minimized/maximized flags, task/element references, return focus and disposal. `ResizeObserver` re-constrains placement; maximized rendering uses workspace bounds without replacing normal geometry. Workspace reserves taskbar space. Pointer capture supports dragging and eight resize edges/corners; title-bar arrow keys move, Shift+arrows resize.

Mount receives a content DOM node and optionally returns cleanup. Minimize hides without unmounting. Close removes window/task and invokes disposal. Window positions/open state do not survive reload. `launch` singleton policy belongs to composition, not the registry. Dynamic file viewers are registered per path and viewer kind.

## Radio and media

One `AudioService` instance is created in `desktop.js` and injected into `radioApp`. Its single `Audio` element survives closing/minimizing/reopening the UI. `subscribe(listener)` returns unsubscribe; `emit()` broadcasts state. Public controls include `play()`, `pause()`, `stop()`, `select(index, play=false)`, `next(automatic=false)`, `previous()`, `seek()`, `setVolume()`, `toggleMute()`, `toggleShuffle()`, `cycleRepeat()` and `enableAnalyzer()`; `track` exposes the current entry. Playback starts only from user action. It does not persist across page reloads.

Music/Broadcast tabs filter the visible playlist; playback operates on the shared catalog queue. Repeat is off/all/one; shuffle affects next selection. Track errors/loading are surfaced in player and taskbar. Lazy Web Audio analysis preserves direct audio output and has a fallback when unavailable. Player disposal cancels visual work/subscriptions, not the service. Artwork load/error handlers handle track switches and fallback; aspect ratio is preserved and original image colors are excluded from tinting/CRT overlays. Browser codec, autoplay and audio-context policies still apply.

`loadMediaCatalog()` fetches `media/library.json` without caching, validates version/entries, deduplicates IDs and restricts resolved sources to same-origin media paths. Artwork must resolve under artwork. Encoded catalog paths are resolved without double encoding. Missing/invalid library raises a visible error without blocking the desktop.

Catalog shape:

```json
{"version":1,"entries":[{"id":"tracks/<original filename>","section":"music","src":"tracks/<URL-encoded filename>","title":"<display title>","artist":"<artist>","album":"","description":"","artwork":null,"order":0}]}
```

`section` is exactly `music` or `broadcasts`. `id` is unencoded relative path; `src`/`artwork` are URL-encoded paths relative to media. Duration comes from the audio element. `generate(root)` returns a dictionary without writing; the script entry point writes `media/library.json`.

The scanner recursively scans nonempty MP3/OGG/WAV/M4A files, skips symlinks, ignores malformed sidecars and sorts by section, numeric order, title and ID. Optional `<audio filename>.json` sidecars support title, artist, album, description, artwork and order. Explicit artist wins over embedded ID3, then `Unknown artist`; titles fall back to filename stems with underscores/hyphens replaced. `read_artist(path)` handles ID3v1 and v2.2/2.3/2.4 artist frames/encodings on a best-effort basis; it does not invent names or infer artists from filenames.

PNG auto matching normalizes Unicode NFC and case-folds stems, ignoring extensions. Unique exact-case matches take priority over ambiguous variants. Explicit artwork is relative to `media/artwork`, constrained to that directory; explicit null disables automatic matching. Missing/ambiguous artwork is omitted. URL quoting preserves path separators and encodes special characters. The generator does not decode audio to prove validity; a corrupt nonempty file can be cataloged. See `media/README.md` and the generator itself before uploads.

## Settings, theme tokens and storage

`window.ZombThemeSchema` exposes `groups`, `keys`, `palette(id)` and `validate(value)`. Its groups define exact semantic keys: Desktop; Windows; Taskbar and menus; Text and links; Controls; Surfaces; Applications. Each becomes `--ui-<key>` (case-sensitive), e.g. `--ui-titleActive`, `--ui-selectionBackground`, `--ui-radioAccent`. The source is the complete token inventory. `themes.css` maps defaults alongside legacy `--green`, `--dark-green`, `--black`, `--tone-0` through `--tone-30` and spectrum tokens. Custom painting bridges old tokens; app-specific page/Arcade colors can differ intentionally from chrome.

Preset IDs are `toxic`, `amber`, `ice`, `blood`, `violet`. A sixth selection `custom` refers to **one saved custom slot**, not a collection of named presets. The editor offers native color/hex inputs, name, immediate preview, Apply, Save custom, Cancel, Reset default, JSON import/export and advisory contrast warnings. Editing a preset drafts a custom theme, leaving built-ins intact. Reset default previews Toxic Green until applied; closing Settings cancels unsaved preview. Native picker/dialog rendering is browser/OS-controlled.

`window.ZombSettings`: `get()` deep copy; `preview(patch)` validates/paints without saving; `cancelPreview()` restores saved appearance; `apply(patch)` validates, paints, saves, notifies and returns persistence success; `reset()` applies Toxic Green; `subscribe(listener)` returns unsubscribe. Invalid apply returns false; storage failure also returns false while valid state remains usable in memory. Settings categories are composed in `settings-app.js`; there is no separate theme service to replace.

| Storage key | Saved value | Bounds / fallback |
| --- | --- | --- |
| `zombos.settings.v1` | `{theme, showHiddenFiles, custom}` | Invalid preference falls back; custom null or strict version-1 theme |
| `zombos.zombnet.v1` | `{bookmarks:[{url,title}], history:[{url,title}]}` | 50 bookmarks / 100 unique recent internal URLs, titles 200 chars |
| `zombos.arcade.v1` | Object mapping game ID to high-score integer | At most 100 validated IDs, nonnegative safe integers |

Custom JSON requires `{version:1,name,colors}` with name at most 60 characters and exactly all schema keys as six-digit hex colors. Editor import size is bounded to 32 KB. Unknown/missing keys are rejected. Adding tokens needs a migration or old custom themes would be rejected. Preferences remain local; unavailable/corrupt storage falls back safely. Different origins/ports have separate storage. No saved desktop window sessions, audio sessions or shared persistent discoveries exist.

## File Explorer and virtual filesystem

`VirtualFilesystem` extends `EventTarget`: `replace(entries)`, `resolve(path,showHidden=false)`, `list(path,showHidden=false)`, `discover(key)`; mutations emit `change`. `normalizePath` handles C: paths, slash conversion and dot segments; `parentPath` supplies parents. Case-insensitive map keys enforce uniqueness; hidden/locked ancestors also gate descendants. Entry metadata includes path/name/type, hidden/system/description, optional unlock, content/src/appId/trackId, size/modified where supplied.

Current root is `C:\` with Desktop, Documents, Music, Pictures, Videos. Documents/Videos are empty. Earlier proposed Laboratory/Archives/System/Broadcasts directories are not current implemented content. `filesystemContent(installed,catalog)` creates Desktop app shortcuts, Music entries from music tracks, and unique associated PNG Pictures, with nested paths. It does not scan arbitrary assets or automatically create broadcast listings. The catalog load replaces the projection and emits change.

Explorer implements tree expansion, navigation history, address bar, list/details, selection/status, keyboard activation/navigation, splitter, preview/properties and shared Show Hidden Files preference. Unsupported destructive operations are disabled. Application shortcuts call the existing launch function; music opens Radio and selects the corresponding service track without restarting an already-playing selection. Text/image/Properties viewers use the existing manager. Hidden content and unlock flags are public presentation rules, not security. Discovery sets are currently independent/in-memory.

## ZombNET and Arcade

`parseAddress` accepts fictional `zomb://` and external HTTPS; `arcade.zomb` aliases `zomb://arcade`. It rejects credentials, invalid internal ports, dangerous schemes and HTTP. Internal hostnames normalize to lowercase; trailing slash normalizes, query/fragment remain part of lookup.

`ZombNetwork` exposes `register(page)`, `get(url)`, `directory()`, `discover(key)` with a Map and discovery Set. `internalPages` contains home, radio and arcade. Definitions support title/heading/description/layout, directory/listed/hidden/unlock, blocks (text/link/action) and optional `mount(container)` cleanup. Add definitions here without rewriting navigation. Listed pages appear in directory; hidden/unlisted pages remain directly addressable; unlock gates lookup. No private data belongs in pages.

`zombnetApp(network,state,launch)` supplies Back/Forward/Home/Refresh, address bar, bookmarks/history and status. Unknown/locked addresses show an error page. History stack is window-local and bounded; saved history is unique recent pages, not every visit. `ZombnetState` exposes `clean`, `save`, `visit`, `bookmark`, `remove`, `clear`. External links open a real tab with opener/referrer protections and popup-blocked fallback; never iframe external sites or render address input as HTML. External visits are not stored. Minimization preserves navigation; closing resets current navigation but leaves saved bookmarks/history.

`mountArcade` is reused by the direct app and internal Arcade page. `arcadeGames` currently contains only DEAD SPRINT. `ArcadeScores.get/record` stores validated best scores. `DeadSprint` separates simulation from `mountDeadSprint` canvas/input/lifecycle. Space/touch actions, pause/restart, visibility/focus pause, capped simulation timestep and cleanup are implemented. High scores persist; active runs do not. Graphics are procedural and intentionally retain their own colors. There is no completed shared unlock system or complex quest engine.

## Automation, verification and limitations

`media-library.yml` runs on relevant pushes to **main** or manual dispatch. It always checks out main, asserts branch-based Pages from `main /`, generates the catalog, commits only that catalog, pushes main, and requests a Pages build explicitly. Token-created commits do not themselves trigger that build. It requires contents/pages write permissions. **Manual dispatch is not a preview operation.** Current live Pages configuration, permissions, deployment health and custom-domain DNS were not verified; `CNAME` alone proves none of them.

Handoff checks passed: five Node test files (`arcade`, `filesystem-content`, `theme-schema`, `virtual-filesystem`, `zombnet`), two Python unittest methods (including ID3 subcases), syntax checks for script.js/all js modules, and read-only generation yielding 10 music/3 broadcasts with all 10 music covers. Runtime was Node 24.19.0 and Python 3.12.14. Tests exercise models/schema, not full browser rendering, media decoding, live signup or deployment.

No browser suite is committed. Earlier cloud browser harnesses were temporary and must not be assumed available locally. No new browser/live-site tests were run for this docs-only handoff. Local acceptance should cover all apps, themes/contrast, minimum/mobile layouts, focus/disposal, real-track playback and artwork, and signup with intercepted submission. Other debt: stale committed catalog; one custom slot; schema migration needed for future keys; large original covers; independent discovery stores; browser-specific audio/visualization support; no persisted window sessions. Do not turn these observations into unrequested fixes.
