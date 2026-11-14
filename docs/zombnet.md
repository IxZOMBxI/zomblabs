# ZombNET foundation

`zombnet-network.js` owns URL parsing and the public internal page registry.
`zombnet-state.js` owns browser-local persistence. `zombnet-app.js` owns navigation,
rendering, external opening and controls. The desktop registers the existing
singleton app ID `zombnet`; its shortcut automatically appears in Explorer.

## Add a site/page

Add an entry to `internalPages` in `js/zombnet-network.js`. The following is a
documentation-only template, not an approved advertiser or a live route. Replace
its placeholders only with approved content and a verified RADIO advertisement association:

```js
{
  url: 'zomb://your-site/path',
  title: 'Your page title',
  heading: 'Your heading',
  description: 'Plain text introduction',
  layout: 'your-site',
  advertiser: true,
  listed: true,
  blocks: [
    { type: 'text', text: 'Plain text content' },
    { type: 'link', label: 'Network directory', url: 'zomb://directory' }
  ]
}
```

Page data is trusted application source, while text and URLs are rendered with DOM
APIs, not HTML interpolation. Add scoped `.zombnet-page[data-site="your-site"]` CSS
for a distinct layout/palette; browser chrome remains themed independently. No
external sites are embedded. Only Home and Network Directory are registered; no advertiser websites currently exist. Home features only publicly
listed advertiser entries explicitly marked `featured: true`; the directory uses the same registry
and optional `category` and `description` metadata. No demo product pages are active.

`advertiser: true` plus `listed: true` includes an unlocked established RADIO advertiser page in the network directory. `hidden: true`
or `listed: false` keeps it out while allowing direct navigation. `unlock: 'key'`
requires `network.discover('key')` before both directory and direct access are
available. Discoveries are session-only. Unavailable destinations show a generic
404. No quests or secret lore are included. Public client-side content is never a
security boundary: do not include actual secrets or private data.

## Exact authoring and publishing steps

1. Confirm the fictional advertiser, its RADIO advertisement association, copy and
   artwork have been approved. Do not infer lore from a recording filename. Record
   that association in the change description; no RADIO catalog edits are needed
   just to register a site. Do not modify the separate Lore Bible.
2. In `js/zombnet-network.js`, add the approved page to `internalPages` using the
   shape above. Choose a unique stable `zomb://host/path`, title and `layout` slug.
   Registration rejects duplicate normalized addresses. There is no automatic
   folder scanning, site generator or second manifest.
3. Set `advertiser: true`. Use `listed: true` for a public directory entry, or
   `listed: false` for an intentionally unlisted address. Omit `unlock` for an
   ordinary unlisted site; it is a different access gate. `hidden: true` also
   suppresses listings. Neither hidden nor unlisted metadata protects secrets.
   Optionally add an approved neutral `category`. Set `featured: true` only for a
   deliberately featured public entry; unlisted/hidden pages remain excluded.
4. Add site styling in `windows.css`, with every selector scoped to that page's
   `layout`. Use the same layout slug for pages sharing an approved site identity.
   Individual typography, palette and layout can differ from ZombOS. Example only:

   ```css
   .zombnet-page[data-site="your-site"] {
       background: #f5f0e6;
       color: #202020;
       font-family: Georgia, serif;
   }
   .zombnet-page[data-site="your-site"] h1 { font-size: 2rem; }
   .zombnet-page[data-site="your-site"] a { color: #244a70; }
   ```

   Scope every branch of comma-separated selectors. Keep CSS variables on the
   site root, use uniquely prefixed animation/font names if needed, and avoid
   global resets, root/body selectors and viewport-fixed overlays. Give custom
   controls explicit scoped styles where global theme rules otherwise win.
   This prevents accidental style leaks by convention, not by an untrusted-CSS
   sandbox. Review the selectors before publication.
5. For simple pages, use `heading`, `description` and `blocks` with text or links.
   For an independently structured page, optionally create a site-specific module
   under `js/`, import its mount function in `js/zombnet-network.js`, and set
   `mount(container)`. Build inside the supplied viewport using DOM APIs and
   `textContent`; mount replaces the generic heading/blocks, so include your own
   navigation. Return cleanup for subscriptions/listeners/timers. Put approved
   optional artwork under a site-specific `assets/` subdirectory and reference it
   from that module. No new application, desktop registration or mobile code is
   required. Use ordinary full-address internal anchors for links between pages.
6. Register each additional page separately. Usually list only the site's landing
   page; set subpages `listed: false` so the directory does not become a list of
   duplicate site entries. Keep addresses stable for saved bookmarks/history.
   Do not register Store products or links that launch standalone applications.
7. Run these focused checks from the repository root:

   ```powershell
   node tests/zombnet.test.mjs
   node --check js/zombnet-network.js
   node --check js/zombnet-app.js
   node --check js/zombnet-state.js
   ```

   Also syntax-check any new site module. When approved public content is added,
   update the test's intentional empty-production-directory expectation to the
   exact approved routes; retain hidden/unlisted and removed-app-route checks.
   Serve the repository over HTTP using `LOCAL_DEVELOPMENT.md`. Open ZombNET and
   verify the directory, direct address, Back/Forward, bookmark/reopen, internal
   links, narrow portrait/landscape sizes and built-in/custom themes. Navigate
   away and inspect another page/application to check for style leakage. Verify
   unlisted content is absent from both Home and Directory but directly reachable.
8. Review only the intended changes on `zombos-preview`. Commit/push and production
   publication are separate approval steps following `LOCAL_DEVELOPMENT.md`; no
   special deployment system is required. Do not dispatch `media-library.yml` as
   a site preview test.

The current registry remains unchanged and its advertiser directory remains empty.
The optional module and asset paths above are authoring conventions, not existing
sites or files to create before approved content exists.

## URL and navigation behavior

Internal addresses use `zomb://host/path`; host case and trailing slash normalize.
Query strings/fragments are exact registry keys. HTTPS URLs open a separate tab
from the user gesture, with the opener detached and a no-referrer policy. A blocked
popup produces a clickable HTTPS fallback with `noopener noreferrer`. Credentials
in URLs, HTTP, javascript, data, file and other protocols are rejected. External
navigation leaves the current internal page and desktop audio intact.

Back/Forward has a bounded 100-entry in-window stack. Refresh rereads local page
data. Home opens `zomb://home`. Minimize preserves the current window/stack. Closing
and reopening starts at Home; persistent bookmarks and visited pages remain.

The `zombos.zombnet.v1` localStorage key holds at most 50 unique internal bookmarks
and 100 unique recently visited internal URLs. Titles are capped at 200 characters
and addresses at 2048. External destinations are not logged. Saved records are
validated; corrupt/blocked storage falls back to in-memory state. Nothing is sent
to a server. Clear History clears saved visits and the current back/forward stack;
subsequent navigation creates new history. Locked saved bookmarks do not bypass
network access rules. No cross-device sync is implemented.

## Verification

Run `node tests/zombnet.test.mjs` for URL safety, registry/discovery semantics and
bounded storage checks. Browser checks cover internal navigation, external opening
and blocking, persistence, window controls, themes and background Radio playback.

## Independently styled sites and mounted links

The existing `layout` value sets `data-site` on the page viewport, and is replaced
on every navigation (including errors). Scope **every** site selector under
`.zombnet-page[data-site="your-site"]`, including typography, colors, controls and
layout. Do not use global body/root selectors or inject global style elements.
Site-specific styles belong in the stylesheet; scope them with sufficient specificity
for custom-theme controls. Browser chrome stays outside this scope. This is trusted
repository code, not a sandbox for untrusted scripts or CSS.

Mounted pages may use ordinary anchors with full `zomb://` or `https://` addresses;
the viewport routes them through the existing navigation/security path. Mount-owned
handlers that preventDefault retain control. Return a cleanup function for listeners,
timers or game resources; it runs before navigation and on close. Hidden/unlisted
pages remain directly reachable, but cannot be featured merely by setting `featured`.
No discovery content or new access system is introduced.
`tests/zombnet-browser.html` provides isolated in-memory browser checks for the homepage, directory, mounted links, styling cleanup, saved navigation, narrow layouts and empty Store compatibility. Serve it over HTTP; its result reports PASS or FAIL.

## Permanent application boundaries

ZombNET is exclusively for fictional websites associated with established RADIO
advertisements. Register only approved advertiser content and set `advertiser: true`
after verifying that association; metadata is not evidence of canon approval.
Unrelated pages are excluded from public listings. Home/Directory are browser
navigation, not advertised destinations. Empty listings state that no advertiser
websites are available. No replacement sites have been invented.

RADIO and Arcade are standalone apps: their old ZombNET routes have been removed.
Real merchandise and product inspection belong entirely to Zomb Store. Existing
bookmarks/history are retained; obsolete destinations use the normal unavailable
page, and visitors may remove bookmarks through existing controls. Calendar,
Experiment Logs and Social Network retain their own responsibilities.
