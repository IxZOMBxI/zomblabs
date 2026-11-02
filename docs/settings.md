# Appearance settings

Settings is registered as `settings`; application IDs remain stable. Window manager
`title` fields are presentation labels and can use any clean display name.

`js/settings-state.js` owns defaults, validation, the built-in theme list, local
persistence (`zombos.settings.v1`), and subscriptions. It runs before styles to reduce
first-paint flashes. `get()` returns a copy, `apply({theme})` validates and applies,
`reset()` restores Toxic Green, and `subscribe(listener)` returns an unsubscribe
function. Failed storage writes still apply for the current visit. Corrupt or unknown
saved themes fall back to Toxic Green. No preferences are transmitted.

`js/settings-app.js` owns category navigation and draft controls. Add future categories
to its category list, with a mount function returning cleanup. Extend the state schema
and validation explicitly when adding new preferences. Preview changes are local to
the preview; Apply commits them, Reset discards unapplied changes, Restore Default
immediately applies and saves Toxic Green.

`themes.css` is the central color palette, including original Toxic Green values,
translucent effects, spectrum colors. Album artwork keeps its original colors. Legacy CSS aliases `--green`,
`--dark-green`, and `--black` remain for compatibility but vary with the selected theme.
Radio visualization reads the active palette without recreating its audio graph.

Explorer shares `showHiddenFiles` (boolean, default false) in this store. Partial
updates preserve the other preference; resetting Appearance does not change it.
