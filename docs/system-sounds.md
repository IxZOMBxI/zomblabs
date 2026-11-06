# System sounds

`js/system-sounds.js` owns short original triangle-wave cues. Desktop owns one
instance, its Settings subscription and delegated trusted-input listeners.
WindowManager receives an optional sound callback. Phone receives the same service
and stops its ring before starting recording playback. Recording ownership remains
with the existing Radio/Phone services; system sounds never pause or seek Radio.
All cues are suppressed during connected calls and replays.

Settings → UI Sounds saves `systemSounds` (default true) and `systemSoundVolume`
(0–1, default 0.25) in the existing `zombos.settings.v1` object. Old settings receive
defaults; theme imports/exports do not contain these preferences. Storage failure
keeps preferences for the current visit.

Call `sounds.play(name)` on the shared instance for `boot`, `open`, `close`,
`minimize`, `maximize`, `restore`, `click`, `error`, `notification`, or `discovery`.
No notification framework is introduced. VFS/network `discover(key)` emit a
dedicated discovery event only for a new key. Generic errors currently cover native
form validation, Radio/Phone service errors and window mounting failures.

AudioContext is created/resumed only after trusted input. Blocked cues are dropped,
not queued for later surprise playback. Ringing repeats every 2.2 seconds while
eligible; leaving ringing, muting, losing page activity, or disposal cancels it.
Only one synthesized cue plays at a time, with a 100 ms rate limit. One delegated
click handler covers mouse/touch/keyboard button activation and defers until after
semantic handlers. No pointerdown/keydown activation sounds are duplicated.

Focused checks: `node --test tests/system-sounds.test.mjs` and the existing Node
suite. Browser listening, device volume balance, mobile interaction and actual
autoplay behavior still require manual acceptance; mocked AudioContext tests do
not establish audible quality.
