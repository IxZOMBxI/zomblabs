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
