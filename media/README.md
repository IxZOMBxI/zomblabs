# Uploading RADIO.exe recordings

## One-time owner setup (before deployment)

The checkout has no existing deployment workflow and includes a root CNAME.
Remote Pages settings could not be read in this environment (API Forbidden).
The new workflow **only** supports existing branch-based Pages from `main`, `/ (root)`;
it checks that setting before writing anything. Verify Settings → Pages first.
Do not switch an existing Actions deployment to branch publishing just for this feature:
instead add `python3 tools/generate-media.py` before that deployment's artifact upload,
ensuring `media/library.json` and the media folders are in the uploaded site.
For another publishing branch/path, adapt the guarded workflow to that existing source.

For supported branch publishing, allow Actions read/write repository permissions and
ensure branch protection permits the catalog bot commit (or adapt to your reviewed PR
process). The workflow commits only the small JSON catalog, then requests a Pages build
explicitly because GITHUB_TOKEN commits do not automatically trigger Pages. Build success
still depends on GitHub permissions/settings. No workflow has been run or deployed here.

## Add a track through GitHub

1. Open the repository's Code tab on `main`.
2. Open `media/tracks`, choose **Add file → Upload files**.
3. Drag an MP3, OGG, WAV, or M4A file into the upload area.
4. Choose **Commit changes** (or create a branch/PR and merge into main).
5. In Actions, wait for **Update media library**, then the Pages build to complete.
6. Reload the website and open RADIO.exe. A commit alone does not update an already-open player.

For broadcasts, use `media/broadcasts` instead. The sections are managed independently.
Use `media/artwork` for PNG/JPEG/WebP/GIF cover images. Delete recordings through GitHub's
file menu and commit; the next catalog run removes their entries. No manual JSON library
editing is needed. Keep files within GitHub's web-upload and Pages size limits; do not
use Git LFS. Prefer compressed audio for real releases.

## Optional per-recording metadata

Next to `My Track.mp3`, use **Add file → Create new file**, name it
`My Track.mp3.json`, and enter:

```json
{
  "title": "Your actual title",
  "artist": "Your artist name",
  "album": "Your album",
  "artwork": "cover.jpg",
  "description": "Optional broadcast description",
  "order": 10
}
```

Artwork paths are relative to `media/artwork`. Lower order numbers appear first within
each section; ties sort by title/path. Missing titles derive from filenames, replacing
hyphens and underscores with spaces. Missing artists display Unknown artist. Embedded
ID3 tags are not parsed. Invalid sidecars fall back to filename defaults; missing or
unsafe artwork is omitted. Unsupported extensions and empty files are skipped.
A corrupt nonempty audio file can still be listed: the browser reports playback errors
and lets visitors select another recording. Codec support varies by browser.

The two `development-tone.wav` recordings and their sidecars are generated test tones,
not real music or broadcast releases. They may be deleted when real content is ready.
The old `media/music` tone was moved, not duplicated.

## Local maintenance

Run `python3 tools/generate-media.py` from the repository root. Output is deterministic
`media/library.json`, with version 1 and entries containing stable path IDs, section,
URL-encoded relative source/artwork paths, and metadata. No timestamps, dependencies,
audio copies, automatic discovery API calls, or credentials are required in the browser.
An empty catalog leaves RADIO.exe usable with a no-recordings message. A missing/invalid
catalog displays a reload-to-retry message without blocking desktop startup.

Playback survives window closure but not page reload. Shuffle chooses another catalog
entry; Previous follows catalog order. Repeat cycles off/all/one. Music precedes broadcasts
in the shared playback queue. Selecting while paused does not start playback.
