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
        this.apps.set(app.id, app);
    }

    open(id) {
        const app = this.apps.get(id);
        if (!app) throw new Error(`Unknown app: ${id}`);
        return this.windowManager.open(app);
    }
}
