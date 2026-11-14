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
    { url: 'zomb://home', title: 'ZombNET — Home', layout: 'network-home', listed: true,
        heading: 'ZombNET', description: 'Fictional websites associated with RADIO advertisements.', category: 'Navigation', home: true,
        blocks: [{type:'link',label:'Browse the network directory',url:'zomb://directory'}] },
    { url: 'zomb://directory', title: 'ZombNET — Network Directory', layout: 'network-directory', listed: true,
        heading: 'Network Directory', description: 'Browse established fictional RADIO advertiser websites.', category: 'Navigation', directory: true,
        blocks: [{type:'link',label:'Return to ZombNET Home',url:'zomb://home'}] },

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
    directory() { return [...this.pages.values()].filter(page => page.advertiser === true && page.listed && !page.hidden && this.get(page.url)); }
    discover(key) { if (this.discoveries.has(key)) return; this.discoveries.add(key); this.dispatchEvent(new Event('discovery')); this.dispatchEvent(new Event('change')); }
}
