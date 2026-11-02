export async function loadMediaCatalog() {
    const url = new URL('../media/library.json', import.meta.url);
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Media catalog unavailable');
    const data = await response.json();
    if (data.version !== 1 || !Array.isArray(data.entries)) throw new Error('Invalid media catalog');
    const seen = new Set();
    return data.entries.flatMap(entry => {
        try {
        if (!entry || typeof entry.id !== 'string' || seen.has(entry.id) || !['music', 'broadcasts'].includes(entry.section) || typeof entry.src !== 'string') return [];
        const src = new URL(entry.src, url);
        if (src.origin !== url.origin || !src.pathname.startsWith(new URL('./', url).pathname)) return [];
        seen.add(entry.id);
        let artwork = null;
        if (typeof entry.artwork === 'string') {
            const image = new URL(entry.artwork, url);
            if (image.origin === url.origin && image.pathname.startsWith(new URL('artwork/', url).pathname)) artwork = image.href;
        }
        return [{ ...entry, title: typeof entry.title === 'string' ? entry.title : entry.id,
            artist: typeof entry.artist === 'string' ? entry.artist : 'Unknown artist', src: src.href, artwork }];
        } catch { return []; }
    });
}
