# M14 — Zomb Store

Zomb Store is an installed desktop/Start/Explorer application using the existing
window manager. `js/store-app.js` provides inventory UI and shared product-page
rendering. `js/desktop.js` owns a single backpack across window mounts. Existing
delegated system button sounds cover transfers; there is no separate audio system.

## Catalog and fixtures

`js/product-catalog.js` exports a validated, deeply frozen `products` array. Store
and ZombNET page closures reference the same records. The four original SVGs in
`assets/store/` are test illustrations, not product photographs or official artwork.

Records contain `id`, `title`, `description`, `details`, `category`, `images`
(`src`, `alt`), `brand` (`label`, `fictional`), `type` (`physical`/`digital`),
`kind` (`demo`/`real`), `status`, `price`, `currency`, `variants` (`id`, `label`),
`url`, `provider`, and `review` (`canon`, `note`). Price, when supplied for future
real records, is an integer in currency minor units. Provider references may hold
only a name and product ID; they are inert public metadata, never credentials or URLs.

Statuses distinguish `demo`, `draft`, `active`, `unavailable`, and `discontinued`.
Drafts are excluded from both browsing and generated pages. Unavailable/discontinued
records can be inspected but not transferred. Validation rejects duplicate IDs or
destinations, unsafe image paths, malformed variants, and incompatible demo data.

To add another demo, extend the fixture list with a unique `demo-` ID and an original
image under `assets/store/`, or pass a complete record through `validateCatalog`.
Demo prices, currency, and provider references MUST be null, canon MUST be `fixture`,
and status cannot be active. No stock counts, shipping claims, or reviews are supplied.
An empty fixture list cleanly disables sample content. No generator is needed.

## Backpack and navigation

`js/backpack-state.js` stores `{version:1, mode:'demo', items:[{id,quantity}]}` under
`zombos.store.demo.v1`. Quantities are integers 1–99; zero removes a row. Missing,
unpublished, unavailable, invalid, or non-demo products are discarded on restoration.
Storage denial falls back to memory with visible feedback. No other ZombOS storage
is read or cleared. There is no cross-tab synchronization in M14.

Transfer, quantity buttons, Remove and a two-step Empty confirmation work with native
keyboard/touch controls. No drag-and-drop is required or implemented. A status region
announces transfers. There are no animations, so reduced-motion users get identical
functionality. At narrow window widths the two panels stack; the window content scrolls.

`productPages()` creates each `zomb://demo-lab/products/...` page from its record.
`createZombnetNavigation()` binds to the mounted browser's normal navigate function.
Inspect launches/focuses ZombNET, then navigates through existing history/bookmarks.
Closing the browser removes the bridge binding; reopening rebinds it. Product pages
share transfer logic and offer a return to Store. Future company layouts can wrap
the shared renderer without copying catalog records. The demo host is not canon.

## Commerce is intentionally absent

Checkout is an always-disabled native button with no endpoint or activation switch.
There are no orders, payment forms, downloads, accounts, shipping, stock sync, or
subtotal calculations. Even a valid future active real record cannot enter this
demo backpack. Changing a demo to active is rejected; `demo-` identities cannot be
reclassified as real. Browser-local state is never a source of purchase authority.

Future real products need NEW stable IDs, reviewed factual specifications and imagery,
legal/pricing/fulfillment decisions, variant selection, and a separately versioned
real cart. Never migrate demo quantities into it. Checkout requires a separately
scoped trusted commerce provider/server integration that validates current IDs,
variants, stock and prices, plus explicit secure checkout, order/fulfillment handling,
privacy and payment testing. M14 has no hidden configuration to activate this.

Website metadata does not approve fictional lore. Brand names, company history and
technology claims require the separate Lore Bible process; demo fixture labels do
not establish canon.

## Verification

Run `node --test tests/store.test.mjs`, then the existing Node and Python suites
listed in LOCAL_DEVELOPMENT.md. Serve the repository over HTTP. Check Store at its
default size, resized below 560px, maximized, and on a narrow viewport. Transfer,
inspect, navigate Back/bookmark, return, update quantities, cancel/confirm Empty,
close/reopen, and refresh. Check keyboard focus, themes, and disabled checkout.
Use isolated browser storage for testing. Automated model tests do not establish
touch-device behavior or actual layout quality.

`tests/store-browser.html` is an isolated browser integration harness using the real
Store, ZombNET and window manager with in-memory storage. Serve the repository and
open that path; its result element reports PASS or FAIL for transfers, Inspect,
history, reopening, quantity/removal, confirmation, narrow layout and disabled
checkout. No real user storage or external signup is used. Headless Edge did not
return usable output during this implementation, so this harness is supplied but
browser acceptance remains unverified.
