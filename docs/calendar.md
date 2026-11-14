# Calendar owner guide

Calendar is a read-only application shared by desktop, mobile and installed PWA. Its only content source is `content/calendar.json`. The catalog contains the owner-provided GTA VI first-stream announcement.

## First real schedule

1. Edit `content/calendar.json`, retaining `version: 1` and the `events`, `schedules`, and `exceptions` arrays.
2. Add an actual owner-approved event or weekly schedule using the fields below. Choose a stable, unique lowercase hyphenated ID. Start with `visibility: "draft"`.
3. Supply the real dates, source IANA zone, description, and verified official URL. Remove optional fields you do not need.
4. Run `node tools/validate-calendar.mjs`. Preview from the repository HTTP server described in `LOCAL_DEVELOPMENT.md`; drafts are intentionally invisible.
5. Change the approved record to `visibility: "published"`, validate again, and check Calendar's monthly, Upcoming and detail views locally. Check visitor-local dates as well as source dates.
6. Review the diff. Commit/push to `zombos-preview` only when authorized. Production publication requires the separate approved merge into `main` and checking the existing Pages workflow. Do not dispatch `media-library.yml` for Calendar preview.

## Individual livestreams and special events

The following is a documentation-only draft illustrating fields, not an actual announcement. Replace every example detail before publishing:

```json
{
  "id": "example-event",
  "title": "Example title — replace before publishing",
  "description": "Documentation example only.",
  "category": "Livestream",
  "start": "2030-01-08T19:00:00",
  "end": "2030-01-08T20:00:00",
  "timeZone": "America/Chicago",
  "platform": "Kick",
  "url": "https://kick.com/zomblabs",
  "status": "scheduled",
  "visibility": "draft"
}
```

Place this shape in `events`. Categories: `Livestream`, `Special Event`, `Music Release`, `Community Event`, `Other`. Statuses: `scheduled`, `canceled`, `rescheduled`, `updated`. `end`, `platform`, and `url` are optional. URLs must be HTTPS without credentials. Title and description are required.

For a special event, use category `Special Event` and the actual event information. To cancel a one-time event, retain its start and change status to `canceled`. To move it, change start/end, set status to `rescheduled`, and add `originalStart` with its previous source-local start. Do not duplicate the record. Use `updated` for detail-only changes.

## Weekly schedules

Documentation-only draft for the `schedules` array:

```json
{
  "id": "example-weekly",
  "title": "Example weekly stream — replace before publishing",
  "description": "Documentation example only.",
  "weekdays": [2, 4],
  "time": "19:00:00",
  "durationMinutes": 120,
  "timeZone": "America/Chicago",
  "startDate": "2030-01-01",
  "endDate": "2030-01-31",
  "visibility": "draft"
}
```

Weekdays are Sunday=0 through Saturday=6, without duplicates. Start/end dates are inclusive and source-local. End date, duration, platform and URL are optional; duration is elapsed minutes (1–10080). Weekly occurrences are Livestreams. To change future streaming days while retaining past dates, end-date the old schedule and create a new stable schedule ID starting on the effective date. Retain old exceptions with their old schedule. Avoid overlapping ranges unless intentional.

## Cancel, move or update one occurrence

Add exceptions referencing the original source-local scheduled date. Examples below are documentation-only drafts referring to the example schedule:

```json
{
  "id": "example-cancellation",
  "scheduleId": "example-weekly",
  "originalDate": "2030-01-08",
  "status": "canceled",
  "visibility": "draft"
}
```

To move that occurrence, use this shape instead (never two exceptions for the same original date):

```json
{
  "id": "example-move",
  "scheduleId": "example-weekly",
  "originalDate": "2030-01-08",
  "status": "rescheduled",
  "start": "2030-01-09T20:00:00",
  "end": "2030-01-09T22:00:00",
  "visibility": "draft"
}
```

A move uses the parent's zone and replaces its original occurrence, even across months. Without an explicit end it inherits the schedule duration. For changed details use status `updated` and any of `title`, `description`, `category`, `platform`, `url`, or `end`; only `rescheduled` may override start. Published exceptions require a published parent. Draft exceptions do not alter public occurrences. IDs are unique across all arrays.

Canceled occurrences remain visible on their original dates and are excluded from Upcoming. Rescheduled details show the original source time. There is no visitor editing, reminder, subscription or calendar export.

## Time zones, limits and validation

Use source-local `YYYY-MM-DDTHH:mm:ss` timestamps without UTC offsets, `YYYY-MM-DD` dates, and `HH:mm:ss` weekly times. Use an IANA zone such as `America/Chicago`. The interface converts times and date grouping to the browser's zone. Weekly wall-clock times remain fixed across daylight-saving changes; elapsed durations may span a clock change.

Ambiguous fall-back times and nonexistent spring-forward times are never guessed. The validator rejects them for individual events and explicit moved starts. A generated recurring occurrence at such a time is skipped with an on-screen warning. Supply a rescheduled exception at an unambiguous time to publish that occurrence.

Upcoming covers the next 90 days. Monthly occurrences are generated for the visible month, not stored indefinitely. The generation API rejects ranges longer than 366 elapsed days. Records outside the visible range are not shown.

Run `node tools/validate-calendar.mjs` (or pass another catalog path) before publication. It rejects unknown fields, unsupported versions, malformed dates, invalid zones/categories/statuses/URLs, duplicate IDs, invalid ranges/weekdays and conflicting or invalid exception references. A malformed or missing catalog produces a retryable error, never a storage reset. Reopen Calendar to fetch an updated catalog; it does not poll or add service-worker caching.

Draft visibility is presentation only: the static JSON remains publicly downloadable. Do not put secrets in drafts. No visitor state is written by Calendar.

## Focused checks

- `node --test tests/calendar.test.mjs`
- `node tools/validate-calendar.mjs`
- `node tests/calendar-browser.mjs "C:\Program Files\Google\Chrome\Application\chrome.exe" "<absolute screenshot directory>"`

Browser tests use isolated storage and injected test-only events; they never publish fixtures to the catalog. Physical iPhone Safari and installed-PWA interaction require manual device acceptance.

## Date-only announcements (Time TBA)

For an unconfirmed start time, supply `date: "2026-11-19"` instead of `start` and omit `end`, `timeZone`, and `originalStart`. The UI displays **Time TBA** and retains the announced date in every visitor zone, without creating a placeholder instant. These records appear after timed events on the same local date and remain Upcoming throughout that date. Status remains `scheduled` (or `updated`/`canceled`); date-only rescheduling metadata is not supported. Once the time is confirmed, replace `date` with `start` and its actual IANA `timeZone`, retaining the same ID. Add an end or verified URL only when known. Weekly schedules are unchanged.
