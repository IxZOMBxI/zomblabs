export class AppRegistry {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.apps = new Map();
    }

    register(app) {
        if (!app.id || !app.title || typeof app.mount !== 'function') {
            throw new TypeError('Apps require an id, title, and mount function.');
        }
        if (this.apps.has(app.id)) throw new Error(`App already registered: ${app.id}`);
        // Future apps inherit usable dimensions; defaults cannot be below their minimums.
        const dimension = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
        const minWidth = dimension(app.minWidth, 280);
        const minHeight = dimension(app.minHeight, 220);
        this.apps.set(app.id, { ...app, minWidth, minHeight,
            width: Math.max(minWidth, dimension(app.width, 380)),
            height: Math.max(minHeight, dimension(app.height, 300)) });
    }

    open(id) {
        const app = this.apps.get(id);
        if (!app) throw new Error(`Unknown app: ${id}`);
        return this.windowManager.open(app);
    }
}
