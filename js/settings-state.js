// Loaded before styles to restore appearance before first paint. No network access.
(() => {
    const themes = Object.freeze({ toxic: 'Toxic Green', amber: 'Amber Terminal', ice: 'Ice Blue', blood: 'Blood Red', violet: 'Violet Signal' });
    const key = 'zombos.settings.v1';
    const listeners = new Set();
    let state = { theme: 'toxic', showHiddenFiles: false };
    try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved && Object.hasOwn(themes, saved.theme)) state.theme = saved.theme;
        if (typeof saved?.showHiddenFiles === 'boolean') state.showHiddenFiles = saved.showHiddenFiles;
    } catch { /* Private storage or malformed preferences: use defaults. */ }
    function paint() { document.documentElement.dataset.theme = state.theme; }
    paint();
    window.ZombSettings = Object.freeze({
        themes,
        get: () => ({ ...state }),
        apply(patch) {
            if ('theme' in patch && !Object.hasOwn(themes, patch.theme)) return false;
            if ('showHiddenFiles' in patch && typeof patch.showHiddenFiles !== 'boolean') return false;
            state = { theme: patch.theme ?? state.theme, showHiddenFiles: patch.showHiddenFiles ?? state.showHiddenFiles }; paint();
            let persisted = true;
            try { localStorage.setItem(key, JSON.stringify(state)); } catch { persisted = false; }
            for (const listener of listeners) listener({ ...state });
            return persisted;
        },
        reset() { return this.apply({ theme: 'toxic' }); },
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    });
})();
