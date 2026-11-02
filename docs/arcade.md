# ZombNET Arcade / DEAD SPRINT

`arcade.zomb` is an address alias for `zomb://arcade` in the existing ZombNET parser.
The page registry mounts `mountArcade`; the desktop Arcade application mounts that
same function. No second browser, desktop, or game implementation is involved.
Interactive pages may return a cleanup function; ZombNET calls it on navigation,
refresh, or close. The window manager already calls it for direct app windows.

`arcadeGames` in `js/arcade.js` is the game registry. Future entries supply id,
title, description, and mount(container, scores), returning cleanup. `hidden` and
`unlock` entries are excluded from the default list; a future discovery integration
can expose them. No hidden games, lore, or quest system ships now.

`dead-sprint-engine.js` is deterministic gameplay state; `dead-sprint.js` renders
original procedural pixel characters and scenery on canvas. Score is 10 per catch.
A catch produces a brief non-graphic “tag” animation, then another runner appears.
Runner speed asymptotically approaches 11, below the configurable player maximum 14.
Momentum decays by 2.5 units/second, and each press adds 1.7. Roughly 2–4 taps/second
sustains the chase. Holding Space/repeat events does not add boosts. Starting,
restarting, and resuming consume the gesture without also boosting.

Space/tap operates only on the focused game canvas. Escape pauses; Space/tap or
Resume continues. Blur, minimizing, another app taking focus, and page visibility
changes pause the run. Returning does not resume automatically. Restart is also
available as a button. Canvas touch handling leaves page behavior elsewhere intact.
Navigation or closure cancels the animation loop and removes listeners. Runs do not
survive closure; best scores do. There are no game sounds to interfere with Radio.

`ArcadeScores` stores per-game bests in `zombos.arcade.v1`, using the same optional
localStorage pattern as ZombNET/Settings. IDs and scores are validated, storage is
bounded to 100 games, and corrupt/unavailable storage falls back to memory. There
are no accounts, network score requests, or online leaderboards. Scores are local
and editable by the visitor, not authoritative.

Run `node tests/arcade.test.mjs` for deterministic gameplay, difficulty, scores and
routing checks. Browser verification uses Chromium and emulated touch; real device
feel, longer balancing sessions, and other browsers still need manual review.
