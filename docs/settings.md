# Appearance settings

The first-class Settings app uses the shared `ZombSettings` state service. Theme
preferences and Explorer hidden-file visibility share one local persistence key.
Application IDs remain stable; window titles are presentation labels.

## M12 advanced theme editor

`theme-schema.js` defines grouped semantic color keys, preset seed palettes and the
strict version-1 JSON format. It loads before settings restoration. Existing preset
CSS values stay intact; custom palettes set `--ui-*` variables and legacy aliases
through the same settings service, with scoped chrome rules in windows.css.

Settings offers native color inputs and editable #RRGGBB fields. All valid edits and
preset selections preview immediately; Apply commits, Cancel or window closure
reverts unsaved changes, Reset to default previews Toxic Green, and Save custom
stores a custom snapshot. Only one named custom slot is maintained. Presets are
never overwritten. Export downloads the current palette; Import previews a validated
file, requiring Apply to persist. JSON must have exactly version/name/colors, all
supported color keys, six-digit hexadecimal values, and a name of at most 60
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
