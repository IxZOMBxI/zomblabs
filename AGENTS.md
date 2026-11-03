# ZombOS development instructions

ZombOS is the static Zomb Labs website presented as a fictional personal computer: a login/boot sequence leads into a green CRT, Windows 95/98-inspired desktop. Preserve its identity and working applications. Read HANDOFF_SUMMARY.md, PROJECT_CONTEXT.md and the relevant subsystem documentation before changing code.

## Permanent rules

- Work on `zombos-preview` unless explicitly instructed otherwise. Never merge into `main` without user approval. Do not deploy or change Pages settings incidentally.
- Do not automatically commit or push unless explicitly requested in the current task.
- Inspect branch, status, and current implementation first. Preserve existing user changes; never discard them or force-push to resolve divergence.
- Preserve the retro design, login/boot sequence, social destinations, signup integration, background audio, and desktop/mobile behavior.
- Reuse the existing vanilla JavaScript architecture. No framework migrations, unnecessary dependencies, duplicate services, or unrelated refactoring.
- Keep scope to the requested milestone. Do not create placeholder features, invented releases, or unapproved Zomb Labs lore/canon.
- Preserve backward compatibility, including saved settings. Never overwrite or remove user-created theme presets. A future multi-preset migration must retain the current custom theme.
- Explain changed behavior and report actual checks, failures, and limitations. Do not describe unrun tests or planned features as verified.

## Architecture and conventions

`index.html` and `script.js` own the original screens and signup. `js/desktop.js` composes the OS, apps, taskbar, Start menu, installed shortcuts and shared services. `style.css`, `windows.css`, and `themes.css` supply presentation. Modules use relative ES module imports, plain DOM APIs, `textContent` for data, and factory functions returning app definitions. Match nearby conventions; do not reformat unrelated code.

Register an app through `AppRegistry.register({id, title, width, height, minWidth, minHeight, mount})`. Keep internal IDs stable and titles clean (no visible executable suffix). `mount(container)` may return a cleanup function. Use `launch(id)` in desktop composition for singleton focus/reopen behavior; raw `apps.open(id)` creates another window. Add user-facing installed apps to the shared `installed` list so desktop, Start and Explorer's Desktop agree. Sample is a Start-only development app.

`WindowManager` owns placement, focus, pointer dragging/resizing, minimize/maximize/restore controls, taskbar entries and close cleanup. Do not build parallel window controls. Minimize preserves mounted DOM; close calls cleanup. Remove listeners, subscriptions and animation loops on disposal. Keep shared audio and persistent state outside window mounts. Use compact defaults and scrollable content with `min-height: 0`; test below nominal minimum sizes when the viewport is smaller.

## Themes and saved state

`js/theme-schema.js` defines semantic keys and strict import validation. `js/settings-state.js` restores preferences before CSS loads and exposes `window.ZombSettings`. UI lives in `js/settings-app.js` and `js/theme-editor.js`. Use semantic `--ui-*` variables with the existing preset/legacy mappings in `themes.css`; do not create another theme system. Preserve artwork/photo/video/game content colors.

Storage keys and structures are in PROJECT_CONTEXT.md. Treat storage as optional and untrusted. Keep old values readable; provide explicit migrations when schemas change. The strict custom theme validator currently requires every supported color key, so adding keys without migration would invalidate existing saved themes/imports. Preserve saved custom colors and names. Preview must be reversible without overwriting saved state.

## Media and public content

Use `tools/generate-media.py` and `tools/id3_artist.py`, not a second catalog pipeline. Assets belong in `media/tracks/`, `media/broadcasts/`, `media/artwork/`; catalog is `media/library.json`. Preserve original names and files, including legitimate `.exe` text in song names. Do not fabricate or replace missing assets, duplicate large media, alter original colors, or introduce Git LFS without approval. Keep URL encoding exactly once and test spaces, punctuation, Unicode and case-sensitive hosting. Explicit sidecar metadata takes priority.

The VFS and ZombNET contain publicly delivered fictional data, not private computer files. Hidden/unlock metadata is presentation, not security. Never store secrets or request real filesystem access for these features.

## Verification and Git

Use LOCAL_DEVELOPMENT.md for commands. Run relevant committed tests and syntax checks, plus browser checks for changed interactions. Verify default/minimum/resized/maximized/mobile layouts, keyboard/touch, theme persistence, window disposal, and ongoing Radio playback when affected. Mock external signup submission during automation; do not send real messages merely to test UI.

Before any authorized commit, inspect the complete diff and stage only intended paths. Before an authorized push, verify branch and remote, reconcile remote changes without losing work, and push explicitly to `zombos-preview`. Report the actual commit and push result.

**Never dispatch `media-library.yml` as a preview test:** its checkout and push target `main` even on manual invocation, and it requests a production Pages build.
