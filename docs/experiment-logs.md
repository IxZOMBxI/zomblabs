# Experiment Logs publishing guide

Experiment Logs is the real-project portfolio and development journal in ZombOS.
`js/experiment-app.js` registers through the existing app registry, shared installed
list, window manager and launch function. Desktop, mobile and installed PWA use
one catalog and renderer. No new saved state, audio service, backend, or framework
is introduced. Closing cancels pending loading, removes the route listener and stops
any local video. The existing applications and their storage remain independent.

## Content and stable addresses

Edit `content/experiments.json`. Version 1 has `projects` and `logs` arrays. Stable
lowercase hyphenated IDs must not be renamed after sharing links. A project has a
permanent `#experiments/project/<id>` address; an entry uses
`#experiments/log/<id>`. Opening these URLs enters the normal login/boot sequence
and then opens the record in Experiment Logs. Browser back/forward follows these
routes; Archive and parent-project links provide explicit back navigation.

Each project requires id, title, category, summary, description, status, visibility,
logIds, relatedProjects, links, media and sources. Each log requires id, projectId,
title, summary, date, status, visibility, article, relatedProjects, links, media and
sources. Use empty arrays for optional links/media/related projects. Add the new
entry ID to its parent project's logIds as well as its own projectId.

Articles use a small plain-text block format:

```json
[
  {"type":"heading","text":"Objective"},
  {"type":"paragraph","text":"A factual account supported by the listed sources."},
  {"type":"list","items":["A documented result","A documented limitation"]}
]
```

This is a format example, not a production article. HTML is never interpreted.
Keep writing about outcomes useful to visitors, rather than copying implementation
code. Include problems, test results or personal accounts only when sourced.

## Dates, status and evidence

Use null for an unverified date. A date must be a real YYYY-MM-DD calendar date and
must have a `dateSource` matching one of that record's sources. That source must
actually establish the date; passing validation is not a factual review. Dated
entries appear newest first, followed by clearly labelled undated records in stable
ID order. Do not infer development or release dates from the current calendar or
an asset's modification time.

Supported statuses: local-implementation, in-development, prototype, planned,
public-release. A status describes the project or work, not catalog visibility.
Change it only after reviewing the supporting evidence. Public-release requires
real release evidence; a local commit or passing test alone is not proof of deployment.
The initial seven projects/logs are source-backed implementation records with no
verified dates. They make no assertion about deployment or physical-device tests.

Sources are objects with a public repository-relative path and a readable label,
for example `{ "path":"docs/phone.md", "label":"PHONE delivery documentation" }`.
Use public docs/source files only. Never expose credentials, private notes, local
absolute paths or personal data. Each record needs at least one source; review
claims against the actual implementation before publishing.

## Images, video and connections

Media objects have type (image/video), src (repository-relative assets/ or media/
path), alt and caption. Supported images: PNG, JPEG, WebP, GIF, SVG; local video:
MP4, WebM, OGG. Do not add autoplay. Original assets remain unchanged. Images load
lazily; videos load only on request and stop on navigation/close. External video
pages use a normal external link, not an embedded third-party player.

Links use `{ "type":"app", "appId":"radio", "label":"Open RADIO" }` or
`{ "type":"external", "url":"https://...", "label":"Watch development video" }`.
Only existing application IDs and HTTPS external links without credentials are
accepted. Related project IDs must exist. Draft related projects are not displayed.
The initial ZombOS image is the existing temporary PWA icon, identified as such;
it is not a new logo or a fabricated screenshot.

## Drafts and publishing

Use visibility `draft` while preparing a record, then `published` after editorial
review. Here published means visible in the archive, not publicly deployed.
Drafts are excluded from cards, search, timelines, related links and direct routes.
A public log cannot have a draft parent. Static JSON is publicly downloadable when
deployed, including drafts: this flag is not secrecy or access control. Keep
confidential drafts out of the repository entirely.

Before publishing an entry:
1. Verify its claims against the actual project and listed sources.
2. Retain permanent IDs and check parent/related links.
3. Add media files without changing original artwork or recordings.
4. Run `node tools/validate-experiments.mjs` (optionally pass a candidate JSON path).
5. Run `node --test tests/experiments.test.mjs` and preview the record locally.
6. Inspect desktop and mobile layouts and review status/date wording.
7. Use the separately authorized Git/release workflow; the editor is not online.

The validator checks metadata, IDs, dates, app/external links, article block types,
references and local file existence. It cannot establish the truth of prose,
release availability, or whether an external URL is still live.

## Content authority

Real development records are authoritative for project history. Existing media
catalogs remain authoritative for audio; the shared Store catalog remains authoritative
for products. Do not copy product prices or media playlists into this catalog.
The separate Zomb Universe Lore Bible is authoritative for fictional canon; this
milestone does not access it. Experiment Logs describes the real software behind
fictional interfaces and clearly labels demonstrations. It must not invent canon.

## Verification

`node tests/experiments-browser.mjs <chrome-executable> <artifact-directory>` runs
isolated Chromium checks against a temporary local server. Test-only injected
content checks safe rendering and error states; it is not production content.
Real iPhone/Android installation, software keyboards, safe-area behavior, codecs
and external video playback still require physical-device acceptance.
