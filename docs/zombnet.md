# ZombNET foundation

`zombnet-network.js` owns URL parsing and the public internal page registry.
`zombnet-state.js` owns browser-local persistence. `zombnet-app.js` owns navigation,
rendering, external opening and controls. The desktop registers the existing
singleton app ID `zombnet`; its shortcut automatically appears in Explorer.

## Add a site/page

Add an entry to `internalPages`, or call `network.register(page)` before navigation:

```js
{
  url: 'zomb://your-site/path',
  title: 'Your page title',
  heading: 'Your heading',
  description: 'Plain text introduction',
  layout: 'your-site',
  listed: true,
  blocks: [
    { type: 'text', text: 'Plain text content' },
    { type: 'link', label: 'Home', url: 'zomb://home' },
    { type: 'link', label: 'External HTTPS site', url: 'https://example.com/' },
    { type: 'action', label: 'Open Radio', appId: 'radio' }
  ]
}
```

Page data is trusted application source, while text and URLs are rendered with DOM
APIs, not HTML interpolation. Add scoped `.zombnet-page[data-site="your-site"]` CSS
for a distinct layout/palette; browser chrome remains themed independently. No
external sites are embedded. Only Home and Radio ship initially.

`listed: true` includes an unlocked page in the network directory. `hidden: true`
or `listed: false` keeps it out while allowing direct navigation. `unlock: 'key'`
requires `network.discover('key')` before both directory and direct access are
available. Discoveries are session-only. Unavailable destinations show a generic
404. No quests or secret lore are included. Public client-side content is never a
security boundary: do not include actual secrets or private data.

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
