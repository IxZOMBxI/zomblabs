import { filesystemEntries } from './virtual-filesystem.js';
// One projection of existing desktop and catalog data; no second app/media list.
export function filesystemContent(shortcuts, catalog) {
    const slash = String.fromCharCode(92);
    const entries = new Map(filesystemEntries.map(entry => [entry.path.toLowerCase(), entry]));
    function add(folder, components, metadata) {
        let path = `C:${slash}${folder}`;
        components.forEach((name, index) => {
            if (!name || name === '.' || name === '..' || name.includes(slash)) return;
            path += slash + name;
            if (!entries.has(path.toLowerCase())) entries.set(path.toLowerCase(), {
                path, name, ...(index === components.length - 1 ? metadata : { type: 'folder' })
            });
        });
    }
    shortcuts.forEach(app => add('Desktop', [app.id], { name: app.title, type: 'application', appId: app.id }));
    const artwork = new Set();
    for (const track of catalog) {
        try {
            if (track.section === 'music') {
                const parts = new URL(track.src).pathname.split('/tracks/')[1];
                if (parts) add('Music', parts.split('/').map(decodeURIComponent), { type: 'music', trackId: track.id, description: track.title });
            }
            if (track.artwork && !artwork.has(track.artwork)) {
                artwork.add(track.artwork);
                const parts = new URL(track.artwork).pathname.split('/artwork/')[1];
                if (parts && /\.png$/i.test(parts)) add('Pictures', parts.split('/').map(decodeURIComponent), { type: 'image', src: track.artwork });
            }
        } catch { /* One malformed URL cannot prevent other entries from appearing. */ }
    }
    return [...entries.values()];
}
