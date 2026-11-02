import { parseAddress } from './zombnet-network.js';
export class ZombnetState {
    constructor(storage) {
        this.storage = storage; this.key = 'zombos.zombnet.v1'; this.bookmarks = []; this.history = [];
        try {
            const data = JSON.parse(storage?.getItem(this.key));
            this.bookmarks = this.clean(data?.bookmarks, 50);
            this.history = this.clean(data?.history, 100);
        } catch { /* Corrupted or unavailable storage uses empty local state. */ }
    }
    clean(items, limit) {
        if (!Array.isArray(items)) return [];
        const seen = new Set();
        return items.flatMap(item => {
            const parsed = parseAddress(item?.url);
            if (parsed?.kind !== 'internal' || seen.has(parsed.url)) return [];
            seen.add(parsed.url);
            return [{ url: parsed.url, title: typeof item.title === 'string' ? item.title.slice(0, 200) : parsed.url }];
        }).slice(0, limit);
    }
    save() {
        try { this.storage?.setItem(this.key, JSON.stringify({ bookmarks: this.bookmarks, history: this.history })); return Boolean(this.storage); }
        catch { return false; }
    }
    visit(url, title) { this.history = this.clean([{url,title}, ...this.history], 100); return this.save(); }
    bookmark(url, title) { this.bookmarks = this.clean([{url,title}, ...this.bookmarks], 50); return this.save(); }
    remove(url) { this.bookmarks = this.bookmarks.filter(item => item.url !== url); return this.save(); }
    clear() { this.history = []; return this.save(); }
}
