# Appearance settings

The first-class Settings app uses the shared `ZombSettings` state service. Theme
preferences and Explorer hidden-file visibility share one local persistence key.
Application IDs remain stable; window titles are presentation labels.

## M12 advanced theme editor

`theme-schema.js` defines grouped semantic color keys, preset seed palettes and the
versioned JSON format (current version 2). It loads before settings restoration. Existing preset
CSS values stay intact; custom palettes set `--ui-*` variables and legacy aliases
through the same settings service, with scoped chrome rules in windows.css.

Settings offers native color inputs and editable #RRGGBB fields. All valid edits and
preset selections preview immediately; Apply commits, Cancel or window closure
reverts unsaved changes, Reset to default previews Toxic Green, and Save custom
stores a custom snapshot. Only one named custom slot is maintained. Presets are
never overwritten. Export downloads the current palette; Import previews a validated
file, requiring Apply to persist. JSON must have exactly version/name/colors, all
supported color keys for its version, six-digit hexadecimal values, and a name of at most 60
characters. Files over 32 KB, unknown keys, invalid colors and unsupported versions
are rejected without replacing the current palette.

Saved preferences retain the existing storage key and hidden-files preference.
Invalid/outdated custom themes fall back to Toxic Green. Storage failure leaves
changes active for the visit. `preview()` and `cancelPreview()` do not write storage.
No remote requests are involved. Closing Settings cancels an unapplied preview.

Contrast warnings check common text/background pairs against 4.5:1. They are advisory,
not a full accessibility audit; deliberate low-contrast palettes remain allowed.
Semantic tokens cover active/inactive titles, surfaces, text, links, controls,
selection/focus, scrollbars, chrome and individual application interfaces. Tooltip
variables apply to authored role=tooltip elements; native browser title tooltips,
color dialogs and file dialogs remain controlled by the browser/OS.

Artwork/photos/video and DEAD SPRINT canvas graphics are not recolored. Radio's
spectrum is an interface visualization and follows its separate accent/background.
The Editor is scrollable at minimum size; grouped fields collapse independently.

Run `node tests/theme-schema.test.mjs` for validation/restoration behavior. Browser
checks cover actual CSS, import/export, presets, persistence, mobile layouts and
background audio. No framework, build step, or new dependency is introduced.

## M12.3 taskbar and tray colors

Desktop selection, taskbar button normal/active/hover/focus, system tray, clock,
connection and Radio status colors now have dedicated semantic controls. These
custom overrides change colors only; built-in palette styling and layout remain
unchanged. Desktop selection follows the existing hover/focus interaction.

Version 1 imports and saved custom themes are validated against their original
complete key set, then migrated in memory to version 2. Existing color values and
the custom theme name are retained. New colors derive from the theme's existing
button, selection, hover, focus, taskbar, text, border and panel colors. The original
stored value is not rewritten on load; the next explicit save writes version 2.
Version 2 imports require every current key. Unknown keys, missing required keys,
invalid colors and unsupported versions are still rejected. Export uses version 2.

Contrast warnings include normal/active/hovered taskbar text, tray/clock/status
text and selected desktop labels (4.5:1), plus shell focus and boundary colors
(3:1). Warnings never adjust colors or prevent saving. CRT effects remain a
separate preference outside exported palettes.

## M16 mobile usability

Phone Settings keeps the same theme engine and controls. The built-in selector is
first and full-width. Mobile-only guidance explains Apply/Cancel, previewing defaults
and imports, and exporting the current preview. A compact Window/Store color sample
updates through the real semantic variables; short landscape layouts omit only this
decorative sample. Apply/Cancel/save/default/file actions precede advanced colors.
Existing collapsible categories now have mobile descriptions of their affected UI,
and a Back to theme actions button returns focus to Apply. Every color picker and
hex field remains available, including Store colors. The CRT checkbox uses a compact
touch-friendly row. Changing Settings categories removes editor-specific styling.

All new presentation is hidden on desktop. Browser checks compare desktop Settings
geometry, fonts, colors and display against the prior version. Theme v3, v1/v2
migrations, import/export, previews and persistence are unchanged by M16; current
schema details are in `docs/mobile-pwa.md`. Physical phone color-picker/file-picker
and screen-reader behavior still needs device acceptance.

## Local storage recovery

Settings → System Recovery inspects Settings/themes, PHONE, ZombNET, Arcade,
the demo backpack and RADIO preferences through their existing loaders. It offers
a JSON backup download, a typed confirmation for individual resets, and the exact
phrase `RESET ALL ZOMBOS` for a full reset. Resets reload the page. Only the six
explicit ZombOS state keys are reset; unrelated keys and recovery backups remain.
Close other ZombOS tabs before resetting so another tab cannot restore old state.

`js/storage-recovery.js` loads before Settings restoration. Safe field/record
repairs keep valid values and save the original raw string under
`zombos.recovery.<original-key>` before writing. Each key retains up to five distinct
originals. If backup space is exhausted, writes are protected rather than discarding
older copies. Corrupt JSON, unsupported versions, blocked reads, and invalid backpack
modes remain untouched. Quota/backup failures permit usable in-memory state without
overwriting the original. After fixing browser permissions/space, reload to retry.
Existing valid v1/v2 theme migration still uses the theme schema; partially damaged
supported themes preserve valid colors/name and fill unusable colors from Toxic
Green. The health report identifies repairs; originals remain exportable.

Use `recovery.html` on the same website/origin if normal Settings is inaccessible.
It uses fixed readable colors, the same validators, and no desktop boot or media
requests. Settings recovery controls also retain readable colors independently of
custom themes. Missing scripts/deployment files and network/media failures are not
local-state corruption; resets will not fix them. Unsupported saved versions need
a compatible app version or a deliberate export/reset, not an automatic downgrade.

Backups contain raw strings, including recovery copies, and may contain personal
theme names or browsing history. Keep downloads private. There is no arbitrary
backup import; existing theme import remains strict. If local backup creation fails,
export first, verify the downloaded file, then explicitly enable the reset override.
Partial exports cannot enable that override. Without a readable backup, retain the
original state and seek manual recovery rather than reset valuable progress.

PHONE uncertainty pauses automatic delivery, preserving surviving history and
unlocks. Ordinary recovery never resets Welcome attempts. Only an explicitly
confirmed PHONE/full reset can permit previously consumed calls to ring again.
Valid backpack rows whose products are absent/unavailable are retained in storage,
but remain unavailable in the demo UI and never become real checkout items.

Focused checks: `node --test tests/storage-recovery.test.mjs` and the relevant
Phone/theme/ZombNET/Arcade/Store/system-sound tests. Optional isolated Chromium UI
check: `node tests/storage-recovery-browser.mjs <chrome-executable> <artifact-directory>`.

Settings keeps Custom Theme Editor, UI Sounds and System Recovery in a persistent
sticky category row while the Settings window content scrolls. The window content
is keyboard-focusable and uses its native vertical scrollbar; no nested flex
scroll panel or outer overflow clipping is required. Native buttons support keyboard
activation and touch; the selected category exposes `aria-pressed`. Startup shows
a dismissible standalone recovery link only when local storage reports protection
or unavailability. This notice is independent of desktop initialization and does
not change recovery policies or reset confirmations.
