# Virtual filesystem and Explorer

This is a fictional, read-only website filesystem, never the visitor's real disk.
No local filesystem permissions are requested. Publicly shipped hidden/locked data
is NOT a security boundary: never include secrets, credentials, private files, or
protected content.

Add entries to `filesystemEntries` in `js/virtual-filesystem.js`. Each has a stable
`path` such as `C:\\Documents\\Guides\\About.txt`, a `name`, and `type`. Ensure its
parent folder exists. Paths resolve case-insensitively; duplicate paths are rejected.
Folders use type `folder`; nested folders work without UI changes. Optional fields:
`description`, `size` (bytes), `modified` (display string), `hidden`, `system`, `unlock`.
Text uses a plain `content` string, rendered safely as text, not HTML. Missing size
and dates show a dash, never invented values.

Hidden entries are excluded unless View → Toggle hidden items is enabled. An optional
`unlock` string additionally requires `filesystem.discover(key)` in the current page
session. Discoveries emit a change event so Explorer refreshes. Ancestor visibility
also applies, including direct address navigation. No quests, passwords, persistence,
or invented lore are included. Extend this small discovery interface when actual
story requirements exist; it is presentation logic, not authorization.

`js/explorer-app.js` contains the file-type action dispatch table. Music and broadcast
shortcuts call the existing singleton Radio launch API. Text opens a reusable viewer
through the app registry/window manager. Unknown types open Properties. Add a handler
to the table for new types. Viewer instances are keyed by virtual path and mode.

Toolbar navigation maintains a back/forward history; Home is C:. Refresh rereads the
virtual data, not the network. Address entry, tree navigation, Open, double-click,
Enter, arrow selection and Backspace are supported. Touch can select then press Open.
View offers List/Details and hidden entries. Edit operations are visibly disabled.
The pane divider supports pointer dragging and left/right keys. Views and folder
history last only for the lifetime of an Explorer window. Theme settings apply via
existing palette variables. No real media files are duplicated by this filesystem.
