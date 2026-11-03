# Local development on Windows

## Open and verify the existing checkout

Use GitHub Desktop to select `IxZOMBxI/zomblabs`, then Repository → Show in Explorer to locate the actual checkout. Open that folder in Codex Desktop. It must contain `.git`, `index.html`, `js`, `tools` and these handoff documents. Do not create a second project over existing files.

The historical path `O:\Zomb Labs - Site\media` was a media source supplied by the owner, not a verified current repository root. Cloud `/workspace/zomblabs` is not a Windows path. Confirm the real local folder rather than guessing.

In PowerShell opened at the repository root:

```powershell
Get-Location
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git status --short
```

Expected repository remote is `https://github.com/IxZOMBxI/zomblabs.git` (SSH equivalent is fine) and branch is `zombos-preview`. If another branch is active, inspect uncommitted work before switching. Never discard changes to make switching/pulling easier. Use GitHub Desktop's Current Branch control or `git switch zombos-preview` once safe. Read AGENTS.md and HANDOFF_SUMMARY.md in each fresh Codex conversation.

## Update through GitHub Desktop

Select preview, review Changes, then Fetch origin. If remote changes exist and the working tree is clean, Pull origin. If local edits or unpublished commits exist, review/back them up and reconcile deliberately; don't reset, force push, or overwrite them. Compare History after pulling and verify the branch again. Fetch is not publish. Do not pull production code over preview merely because main is marked default.

For future agent sessions, state the requested task and whether committing/pushing is authorized. Opening the project does not authorize either action.

## Tooling and local server

Install Python and, for tests, Node.js. The handoff used Python 3.12.14 and Node 24.19.0; Python 3.12+ and Node 24 LTS are suitable starting points. There are no pinned runtime files, npm install step, external Python packages, frontend build or framework migration to perform.

```powershell
py -3 --version
node --version
py -3 -m http.server 8000 --bind 127.0.0.1
```

Keep this terminal running and open `http://localhost:8000/` in a modern browser. Stop with Ctrl+C. If the Python launcher is absent but Python is installed, replace `py -3` with `python`. Use a different port if 8000 is occupied. Serve from the repository root; `file://` opening breaks module/fetch behavior. This server is local only and does not deploy.

Keep the same hostname/port during persistence tests: localStorage differs between localhost, 127.0.0.1, ports, and production. Browser refresh normally loads edits; use DevTools Network/cache controls to diagnose stale assets.

## Media catalog

The handoff base has real assets but a stale catalog pointing to removed test tones. In a task authorized to fix/update media, run from the repository root:

```powershell
py -3 tools/generate-media.py
git diff -- media/library.json
$library = Get-Content media/library.json -Raw | ConvertFrom-Json
$library.entries | Group-Object section | Select-Object Name, Count
$library.entries | Select-Object title, artist, src, artwork
```

Expected scan at handoff: 10 music, 3 broadcasts, 10 music covers. Verify current files before relying on those counts. The command writes the catalog; do not run it casually during documentation-only work. No automatic generation runs on preview pushes under the current workflow.

Place original audio in tracks/broadcasts and covers in artwork. Same-stem PNGs match regardless of extension/case where unambiguous. Preserve filenames, including spaces and punctuation. Optional sidecars use the full audio filename plus `.json`, e.g. `<filename>.mp3.json`, and explicit artist/title/artwork/order override generated values. Artwork paths in metadata are relative to artwork, not absolute Windows paths. Use UTF-8 JSON. Edit embedded ID3 artist tags with an appropriate local tag editor or use an explicit artist sidecar, then regenerate; do not infer artist names from filenames. See PROJECT_CONTEXT.md and media/README.md.

Inspect sizes/ignore rules before authorized uploads with Explorer, `Get-ChildItem media -Recurse -File`, `git status --short` and `git check-ignore -v -- <path>`. Never overwrite originals, add duplicate large files or introduce LFS by default. Test actual decode/cover loading; generator validation is not codec validation.

## Available checks

From PowerShell at the root:

```powershell
$env:PYTHONDONTWRITEBYTECODE = '1'
py -3 -m unittest discover -s tests -p 'test_*.py'
Get-ChildItem tests -Filter '*.test.mjs' | ForEach-Object {
    node --test $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Test failed: $($_.Name)" }
}
node --check script.js
if ($LASTEXITCODE -ne 0) { throw 'script.js syntax failed' }
Get-ChildItem js -Filter '*.js' | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Syntax failed: $($_.Name)" }
}
git diff --check
```

Check Python's reported result before continuing; syntax checks do not prove DOM behavior. On Bash, `node --test tests/*.test.mjs` runs all five Node files. Committed tests cover VFS paths/visibility, projected content, network parsing/storage, Arcade model/scores and custom theme schema, plus Python ID3 extraction/override cases. No committed Playwright/browser runner exists; temporary cloud scripts are not part of this checkout.

Browser acceptance for functional changes:

- Complete login/loading/boot/welcome; initial desktop should have no open windows. Launch every app from desktop/Start and Explorer's Desktop.
- Check drag, resize, overlap, focus, minimize/maximize/restore/close and taskbar at default/minimum sizes, tall/wide/maximized, and narrow mobile/touch widths. Check keyboard activation and focus visibility.
- Exercise all preset/custom theme colors, active/inactive/disabled/hover/focus states, Apply/Cancel/Reset, JSON import validation, save and refresh. Export user custom themes before tests that change preferences; use a separate browser profile for destructive storage tests.
- Play real catalog tracks; switch artwork, seek/stop/pause/volume/shuffle/repeat, visualize, switch tabs, minimize/close/reopen, browse and change theme while audio continues. Confirm missing-file/artwork errors without duplicate audio. Reset browser state by user choice, not automatic blanket localStorage clearing.
- Check Explorer navigation/tree/views/hidden preference, file previews, Properties and Radio shortcuts. Check ZombNET navigation/history/bookmarks, unknown URLs, external HTTPS and dangerous-scheme rejection. Check Arcade input/pause/high scores.
- Verify social destinations and signup validation/state. Intercept/mock FormSubmit in automated tests; real submissions require a deliberate authorized delivery test.

Report browser/version, viewport and actual outcomes. Do not convert an untested behavior into a passing result.

## Commit and push preview only when requested

Review GitHub Desktop's Changes, select only intended files, give a focused summary, Commit to zombos-preview, then Push origin. Equivalent CLI sequence after reviewing scope:

```powershell
git branch --show-current
git diff --check
git diff
git add -- <explicit-file-paths>
git diff --cached --stat
git diff --cached
git commit -m "Describe the completed change"
git push origin HEAD:zombos-preview
git rev-parse HEAD
git status --short
```

Replace placeholder paths/message; never blindly stage all user work. If rejected, fetch/review/reconcile rather than force-push. Report push errors accurately and retain changes. A successful local commit is not proof of upload or deployment.

## Publishing approved updates

Production branch is main. Publishing is a separate explicitly approved operation: review the preview diff and test evidence, use the owner's agreed PR/merge process into main, and inspect GitHub Actions/Pages results. Do not merge as part of ordinary development or this handoff.

The existing workflow expects GitHub Settings → Pages → Deploy from a branch → main / (root). Verify that configuration and required workflow permissions before any approved publication; do not change them merely to satisfy a failing job. `CNAME` declares zomb labs' domain as `zomblabs.com` but does not prove DNS/deployment health.

**Do not manually dispatch `media-library.yml` to test preview.** It explicitly checks out and pushes main, including manual runs, and requests a production Pages build. Its normal main push trigger covers media, generator/ID3 and workflow paths. Preview changes are tested locally; they do not get a separate hosted preview from this workflow. No Pages settings or deployment were changed by the handoff.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Modules/JSON fail | Serve root over HTTP, inspect DevTools console/network and path case |
| Real songs absent / test tone errors | Compare catalog with files; regenerate only in an authorized media task |
| Cover missing | Same stem/case ambiguity, explicit sidecar override, URL encoding, Network 404, PNG decode |
| Unknown artist | Embedded supported ID3 artist tag or explicit artist sidecar, then regenerate |
| Settings appear lost | Same origin/profile; storage permissions; strict schema; only one custom slot currently |
| No audio/analyzer | Explicit play gesture, decode support, browser policy, console; closing page ends playback |
| Signup unavailable locally | Network/service/validation; don't alter integration to hide external-service failures |
| Git push denied | Correct account, repository permission, branch protection and remote; preserve commits |
| Pages job fails | Main/root branch-based publishing assertion, token permissions, logs; don't dispatch preview runs |
