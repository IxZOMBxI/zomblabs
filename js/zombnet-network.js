import { mountArcade } from './arcade.js';
// Public fictional pages. Hidden/unlocked flags are presentation, not security.
export function parseAddress(value) {
    if (typeof value !== 'string' || value.length > 2048) return null;
    try {
        const input = value.trim();
        const url = new URL(/^arcade\.zomb\/?$/i.test(input) ? 'zomb://arcade' : input);
        if (url.username || url.password) return null;
        if (url.protocol === 'https:') return { kind: 'external', url: url.href };
        if (url.protocol !== 'zomb:' || !url.hostname || url.port) return null;
        return { kind: 'internal', url: `zomb://${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, '')}${url.search}${url.hash}` };
    } catch { return null; }
}
export const internalPages = [
    { url: 'zomb://arcade', title: 'ZombNET Arcade', heading: 'Arcade', layout: 'arcade', listed: true, mount: mountArcade },
    { url: 'zomb://home', title: 'ZombNET — Network Directory', layout: 'directory', listed: true,
        heading: 'ZombNET', description: 'The Zomb Labs internal network. Fictional pages stay here; HTTPS websites open in a separate browser tab.', directory: true },
    { url: 'zomb://radio', title: 'Zomb Labs Radio', layout: 'radio', listed: true,
        heading: 'Zomb Labs Radio', description: 'Listen to music and recorded broadcasts through the desktop Radio application. Playback continues while you browse.',
        blocks: [{ type: 'action', label: 'Open Radio', appId: 'radio' }, { type: 'link', label: 'Return to network directory', url: 'zomb://home' }] }
];
export class ZombNetwork extends EventTarget {
    constructor(pages = internalPages) {
        super(); this.pages = new Map(); this.discoveries = new Set();
        pages.forEach(page => this.register(page));
    }
    register(page) {
        const parsed = parseAddress(page.url);
        if (parsed?.kind !== 'internal' || this.pages.has(parsed.url)) throw new Error('Invalid or duplicate ZombNET page');
        this.pages.set(parsed.url, Object.freeze({ ...page, url: parsed.url }));
    }
    get(url) { const page = this.pages.get(url); return page && (!page.unlock || this.discoveries.has(page.unlock)) ? page : null; }
    directory() { return [...this.pages.values()].filter(page => page.listed && !page.hidden && this.get(page.url)); }
    discover(key) { this.discoveries.add(key); this.dispatchEvent(new Event('change')); }
}
