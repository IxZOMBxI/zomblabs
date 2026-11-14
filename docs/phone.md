# Phone recording and delivery guide

Phone is an event-driven call service. Its catalog is separate from Radio's queue
and Explorer's media projection. Only encountered calls appear in Call History.
The catalog and recordings are public site assets; discovery is presentation,
not access control.

## Add a recording

1. Put the original MP3, OGG, WAV or M4A in `media/calls/`.
2. Put a matching PNG in `media/artwork/`. For example,
   `media/calls/Laboratory Control.mp3` matches
   `media/artwork/Laboratory Control.png`. This is a naming example, not bundled content.
3. Create `media/calls/Laboratory Control.mp3.json` using the full audio filename
   plus `.json`. Save the sidecar as UTF-8. Set a unique, permanent `callId` and
   delivery rules. Keep the ID unchanged when renaming/replacing a recording so
   its history, replay unlock and one-time consumption survive.
4. Run `python tools/generate-media.py` from the repository root and inspect
   `git diff -- media/library.json`. Reload the local site to load the catalog.

Example sidecar (replace the example identity with approved content):

```json
{
  "callId": "laboratory-control-intro",
  "caller": "Laboratory Control",
  "extension": "101",
  "title": "Introduction",
  "artwork": "Laboratory Control.png",
  "delivery": {
    "enabled": true,
    "once": true,
    "delaySeconds": 30,
    "event": "desktop.ready",
    "priority": 0,
    "ringSeconds": 30,
    "retrySeconds": 300,
    "onDeclined": "retry",
    "onMissed": "retry",
    "onInterrupted": "retry"
  }
}
```

`caller` falls back to the title, `title` to the filename, and `callId` to the
relative audio path. `extension` is optional and must be a string (so leading
zeroes survive). Explicit artwork is relative to `media/artwork/`; PNG, JPEG,
WebP and GIF are accepted. Omit `artwork` for automatic same-stem PNG matching
(Unicode-normalized, case-insensitive, with exact-case preference). Set it to
`null` to disable matching. Images retain their original colors.

**Always edit sidecars, not generated JSON.** Without a `delivery` object, a
recording is disabled. Malformed sidecars fall back to disabled delivery. Invalid
delivery rules and duplicate call IDs are rejected by Phone. No JavaScript edits
are needed to add recordings using the events below.

The Welcome recording retains its ID, 10-active-second initial delay and
30-second ring window. Its `onAttempt: "consume"` and `unlockOn: ["ringing"]`
rules persist consumption and unlock manual replay at the first incoming attempt,
even without an answer. Existing saved attempts are also consumed and unlocked
without replacing history. Catalog regeneration preserves these sidecar rules.

## Delivery timing

All supplied gates must pass. Boot must be complete, the document visible and
focused, and no call or replay in progress. The eligible queue is recalculated
every 500 ms: larger `priority` first, then stable call ID in lexical order.
Notifications are visual; no recording or ringtone autoplays before Answer.

| Field | Meaning / default |
| --- | --- |
| `enabled` | `true` when a delivery object exists; use `false` to disable |
| `once` | `true`; consumed after recording completion |
| `delaySeconds` | Minimum active time since desktop startup; default `0` |
| `event` | Optional session event required before delivery |
| `schedule` | Optional local calendar time with explicit IANA time zone |
| `priority` | Higher first; default `0`, range -10000 to 10000 |
| `ringSeconds` | Ring timeout; default `30`, range 5 to 300 |
| `retrySeconds` | Retry delay after a non-consuming outcome; default `300` |
| `cooldownSeconds` | Delay after completion/consume for repeatable calls; default `3600` |
| `conditions` | Optional eligibility requirements described below |
| `onDeclined`, `onMissed`, `onInterrupted` | `"retry"` (default) or `"consume"` |
| `onAttempt` | `"retry"` (default) or `"consume"`; consume marks a one-time call delivered at its first ring, including existing saved attempts |
| `unlockOn` | Additional states that unlock replay: `"ringing"`, `"declined"`, `"missed"`, `"interrupted"`; default `[]` |

Delays/cooldowns accept seconds up to 31536000; retries/cooldowns must be at least
one second. Active time excludes boot, hidden tabs and unfocused browser time and
starts over on reload. Retry/cooldown deadlines use wall-clock time and persist.
Session events also reset on reload.

Supported events are `desktop.ready`, `radio.play`, and `app.open:<id>`.
Application IDs include `radio`, `phone`, `settings`, `explorer`, `zombnet`,
`arcade`, `social`, and `updates`. Opening an app includes focusing/reopening an
existing window. `radio.play` is a transition into Radio playback, including an
automatic resumption. Events occurring while inactive are ignored.

For a fixed date/time, add this inside `delivery`:

```json
"schedule": {
  "at": "2026-12-01T19:30:00",
  "timeZone": "America/Chicago"
}
```

`at` must be `YYYY-MM-DDTHH:mm:ss` with no UTC suffix or offset: it is interpreted
in `timeZone`. Invalid time zones and nonexistent/ambiguous daylight-saving times
disable the call. Choose an unambiguous time. The call becomes eligible at that
instant or on the next active visit afterward; there is no expiration window or
calendar recurrence. For simple repeats use `once: false` and `cooldownSeconds`.
An event-triggered repeat needs a fresh event after completion; retry outcomes
may retry the same session event after their retry delay.

Example additional gates, all of which must pass:

```json
"conditions": {
  "completed": ["earlier-call-id"],
  "answered": ["another-call-id"],
  "notCompleted": ["later-call-id"],
  "events": ["app.open:explorer"]
}
```

Answering immediately unlocks replay. Declined/missed recordings remain locked
unless `unlockOn` contains `"declined"` or `"missed"`. End Call, media failure
and closing Phone during a connected call are `interrupted`; closing while
ringing is `missed`. Moving to an inactive tab misses a ringing call and pauses
connected/replay audio. Resume is explicit on return. Minimizing Phone preserves
its state. Replay never changes the original history outcome or consumes a call.

## Audio, storage and lifecycle

The shared storage recovery guard retains raw originals before safe repairs.
Unreadable or unsupported PHONE state protects the original and disables automatic
delivery. Partial repairs preserve valid history/delivery flags and persist
`recoveryHold: true` in the existing version-1 envelope; automatic calls stay paused
after reload. Surviving answered/completed history restores positive delivery and
unlock evidence. Valid Welcome attempt migration remains intact. Available unlocked
history can still be replayed manually. Settings → System Recovery explains the
problem and offers export or a deliberate reset; ordinary recovery never clears
PHONE progress. Clearing PHONE explicitly allows one-time calls again.

Phone holds exclusive audio while connected or replaying, even when paused.
Radio's source and position are preserved; selection/play/seek are blocked during
that hold. Radio resumes when released if it was playing, the page is active,
and the visitor did not explicitly pause/stop it. Browser autoplay denial leaves
a Play/Resume message instead of repeatedly trying to play.

`zombos.phone.v1` stores a versioned history (latest 200 attempts) and delivery
records keyed by stable call ID. Consumption and unlocks outlive history trimming.
Pending attempts become missed/interrupted after reload, using the configured
policy. Existing Settings, Arcade and ZombNET storage keys are untouched. Storage
failure leaves in-memory functionality with a visible notice. Storage is local to
the browser origin/profile, not synchronized between devices. Multiple open
site tabs do not coordinate delivery state; use one tab per visitor session.

Modules: `phone-rules.js` validates configuration and time zones;
`phone-scheduler.js` orders eligibility; `phone-state.js` persists outcomes;
`phone-service.js` owns playback and lifecycle; `phone-app.js` mounts the window
and notification. `desktop.js` supplies boot/focus/app events. Shared artwork
masking keeps Radio and Phone images clear of the global scanlines.

## Local verification

From the repository root on `zombos-preview`:

```powershell
$env:PYTHONDONTWRITEBYTECODE = '1'
python tools/generate-media.py
node --test tests/phone.test.mjs
python -m unittest discover -s tests -p 'test_*.py'
python -m http.server 8000 --bind 127.0.0.1
```

If sandboxed Python cannot use its normal temporary directory, run the tests with
`tempfile.tempdir` set to a writable test directory; do not change the tests' logic.

Open `http://localhost:8000/tests/phone-browser.html` for isolated checks. The page
generates a quiet eight-second test tone and test artwork in memory, and stores
history only in `zombos.phone.browser-test.v1`. It does not add production media.
Finish test boot, trigger the event, then answer/decline. Let a call finish to
verify one-time consumption; End Call instead verifies interruption/retry.
Use Call History for replay, pause/resume/seek/stop. Start Radio before answering
or replaying to verify pause and resumption. Queue missing media tests a deliberate
404 and recovery. Reset test history affects only this test key.

Also check the real desktop at `/`: Phone appears in desktop/Start/Explorer,
no notification interrupts boot, artwork is revealed only after Answer, and
closing/minimizing/maximizing/resizing uses the shared controls. Check a narrow
viewport, keyboard controls, theme changes and reload persistence. Keep the same
origin/port when checking persistence. No real signup submission is needed.

Do not dispatch `media-library.yml` for preview testing: it targets production.
