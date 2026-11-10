# M15 — mobile ZombOS and installation

## Shared desktop and mobile architecture

`js/mobile-shell.js` selects mobile presentation at up to 750 CSS pixels, or on
coarse-pointer devices up to 1100 pixels (including phone landscape). Standalone
detection uses `(display-mode: standalone)` with `navigator.standalone` for iOS;
it does not select mobile by itself. Large desktop windows retain the original UI,
including desktop-installed PWAs. Resizing a narrow desktop window uses mobile UI.

Mobile Home uses the same installed-app list as Desktop, Start and Explorer: Radio,
Phone, ZombNET, Arcade, Store, Explorer, Settings, Social Network and System Update.
The mobile bar offers Home and a running-app switcher. A foreground app fills the
usable workspace. Minimize returns to another app or Home; Close invokes the
existing cleanup. Home/switching do not close, remount or pause applications.
Desktop window geometry is retained while mobile mode is active and restored when
space permits. Desktop drag/resize/maximize behavior remains in WindowManager.

`mobile.css` gates layout rules behind `data-mobile="true"`. It accounts for safe
areas, `100dvh`, the visual viewport (including keyboard changes), touch controls,
scrollable content and portrait/landscape layouts. Boot/login remains unchanged in
logic and must finish before the mobile launcher/navigation appear. Phone notices
remain above the launcher and apps. Existing Radio/Phone audio ownership is shared.
No browser Fullscreen API is called, including in ordinary Safari tabs.

All settings and catalogs remain shared. There is no mobile storage system. Store
demo-only restrictions and disabled checkout are unchanged. Installed apps and
browser tabs may have different storage containers: synchronization is NOT promised.

## Store colors and compatibility

Theme schema v3 adds a Zomb Store group: background, text, panels, borders/dividers,
buttons/hover, inputs, disabled text, focus and feedback accent. Defaults reproduce
the previous Store appearance. Both Store and ZombNET product pages use these keys;
product illustrations retain their original colors.

Strict v1 and v2 imports migrate using the user's existing semantic colors. Existing
names/colors are retained; restoration does not overwrite storage. Apply/export
uses v3. Preview/cancel remains reversible and low-contrast colors are warned about,
not silently corrected. The current single custom-theme slot is unchanged. Older
ZombOS builds do not understand v3 exports, so retain an old export if rolling back.

## Install

- iPhone: Safari → Share → Add to Home Screen → Open as Web App → Add. Menu wording
  and the Open as Web App switch vary with iOS version.
- Android: use the browser's Install App or Add to Home Screen option when supported.

The same instructions are in the nonintrusive Install ZombOS disclosure on Mobile
Home. No installation popup or fake iOS prompt is implemented. The manifest uses
stable ID `/`, start URL `/`, scope `/`, display `standalone`, and unrestricted
orientation. Paths target the production domain root, not a project subdirectory.
Use HTTPS on production; localhost can be used for browser development. A Python
server must serve the repository root. Plain HTTP on a phone's LAN address may not
qualify for installation; localhost on a phone means the phone, not the PC.

The manifest has 192/512 PNGs and iOS has a 180 PNG. These are TEMPORARY derivatives
of the existing Courier-bold “ZOMB LABS” screen wordmark, using its green/black
palette, not a new logo. Final approved app artwork is still needed. They are marked
`purpose: any`, not maskable: separate approved maskable artwork can be added later.
Icons are opaque; browsers may add their own mask/padding. Replace approved icons
at versioned filenames to avoid old installed icons persisting after an update.

`js/pwa.js` updates mobile theme-color metadata from the existing theme, including
custom preview changes. Desktop browser chrome is outside the matching media query.
The installed icon/splash background is static manifest metadata; live theme changes
cannot guarantee an updated operating-system launch screen or status-bar appearance.

## Caching and deployment recovery

There is deliberately NO service worker registration, Cache Storage, offline shell,
precache, push service or automatic reload. Installability without a worker is
supported by current platforms; exact browser promotion criteria vary. No guarantee
is made that every browser offers an Install button. No music/artwork collection,
signup response or future payment response is cached by application code.

Normal browser/GitHub Pages HTTP caching still applies. Existing open tabs retain
their running code until navigation/reload; no active Radio, Phone or unsaved edit
is interrupted by update logic. This does not provide transactional deployment of
all resources: Pages/CDN propagation can still briefly serve mixed versions. Keep
schema changes backward compatible and verify a completed deployment before testing.

After an authorized deployment, finish/stop calls and audio and save unsaved themes,
then reload/relaunch deliberately. Check source for `zombos-build` (currently
`m15-mobile-pwa-1`) and compare with the intended release. For exact files, use the
browser Network panel with cache disabled, reload, and compare fetched source with
the deployed commit. The marker is a milestone label, not automatic commit tracking;
update it in future releases. Confirm manifest/icon HTTP 200 responses and production
root URLs. This milestone does not deploy or change the existing Pages workflow.

If stale content persists, wait for Pages/CDN propagation, then use an explicit hard
reload once work is saved. Do not clear localStorage, website data, or uninstall as
a first step: those may erase themes, call history, scores and backpacks. If DevTools
shows an old worker from a separate experiment, identify that registration and only
unregister it/clear its named caches after confirming ownership and saving work.
This implementation never deletes unrelated registrations or caches automatically.

## Verification and platform limits

Run the existing Node/Python suites plus `tests/mobile-pwa.test.mjs`. The optional
dependency-free `tests/mobile-browser.mjs` runs local headless Chromium with an
isolated profile, local HTTP server and screenshot directory; it never uses personal
browser storage or sends signup forms. Supply the Chromium executable and writable
artifact directory. It compares desktop geometry/styles with Git HEAD, checks mobile
launch/switching, real Radio/Phone audio handoff, Store restrictions, themes/reload,
and portrait/landscape bounds. Temporary profiles/screenshots stay in the supplied
artifact directory for inspection.

The browser runner accepts an optional third argument for the baseline Git ref
(default HEAD). The M15 completion check used `b55876a`, the pre-mobile desktop,
and Chrome 157.0.8103.40. Desktop geometry, colors, fonts and display matched;
maximize/restore/minimize/reopen/close controls passed. Mobile checks passed at
390×844 and 844×390, followed by return to 1280×900 desktop. All nine apps mounted
within the usable viewport. Actual local Radio playback continued through app
switching; an eligible Phone notice appeared with Phone closed, answering paused
Radio, and ending resumed it. Store restrictions, v3 theme preview/cancel/import/
export, and settings/backpack restoration passed with isolated storage.

Completion verification: 32 Node results, four Python tests, JavaScript syntax and
diff checks passed. Chrome's media emulation did not simulate standalone display
mode, so only the detection unit tests passed for that mode; no actual installation
is claimed. Production update propagation was not tested because nothing was deployed.

Physical iPhone/Android acceptance is still required: actual Add to Home Screen,
installed launch, safe areas, software keyboard, orientation, system status/navigation
bars, file import/export/share behavior, autoplay and audio interruption. A simulated
mobile browser does not prove native installation. No native background calling,
guaranteed background audio, push notifications or OS telephony is provided. Offline
launch is not supported. Devices may suspend audio/scheduling when hidden or locked.

References:
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
