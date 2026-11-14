import './storage-recovery.js';
export class ArcadeScores {
    constructor(storage) { this.storage = storage; this.key = 'zombos.arcade.v1'; this.scores = Object.create(null); this.recovery = globalThis.ZombStorage.open(this.key,storage); this.read(); }
    read() {
        try {
            const saved = this.recovery.read(data => Object.fromEntries(Object.entries(data).filter(([id,score])=>/^[a-z0-9-]{1,60}$/.test(id) && Number.isSafeInteger(score) && score >= 0).slice(0,100)));
            if (saved && typeof saved === 'object' && !Array.isArray(saved)) for (const [id, score] of Object.entries(saved).slice(0, 100)) {
                if (/^[a-z0-9-]{1,60}$/.test(id) && Number.isSafeInteger(score) && score >= 0) this.scores[id] = Math.max(this.scores[id] || 0, score);
            }
        } catch { /* Local storage is optional. */ }
    }
    get(id) { this.read(); return this.scores[id] || 0; }
    record(id, score) {
        if (!/^[a-z0-9-]{1,60}$/.test(id) || !Number.isSafeInteger(score) || score < 0) return false;
        this.read();
        if (!(id in this.scores) && Object.keys(this.scores).length >= 100) return false;
        this.scores[id] = Math.max(this.get(id), score);
        try { this.recovery.write(this.scores); return Boolean(this.storage); } catch { return false; }
    }
}
