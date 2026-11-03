// Restore saved appearance before styles load. Preferences never leave this browser.
(() => {
    const schema = window.ZombThemeSchema;
    const themes = Object.freeze({ toxic: 'Toxic Green', amber: 'Amber Terminal', ice: 'Ice Blue', blood: 'Blood Red', violet: 'Violet Signal', custom: 'Custom' });
    const key = 'zombos.settings.v1', listeners = new Set();
    let state = { theme: 'toxic', showHiddenFiles: false, crtEffects: true, custom: null };
    const copy = value => JSON.parse(JSON.stringify(value));
    try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (typeof saved?.showHiddenFiles === 'boolean') state.showHiddenFiles = saved.showHiddenFiles;
        if (typeof saved?.crtEffects === 'boolean') state.crtEffects = saved.crtEffects;
        if (saved?.custom) { try { state.custom = schema.validate(saved.custom); } catch { /* Invalid custom theme ignored. */ } }
        if (saved && Object.hasOwn(themes, saved.theme) && (saved.theme !== 'custom' || state.custom)) state.theme = saved.theme;
    } catch { /* Corrupt or unavailable storage uses defaults. */ }
    function checked(patch) {
        const next = {...state, ...patch};
        if (!Object.hasOwn(themes,next.theme) || typeof next.showHiddenFiles !== 'boolean' || typeof next.crtEffects !== 'boolean') throw Error('Invalid preference');
        if (next.custom) next.custom = schema.validate(next.custom);
        if (next.theme === 'custom' && !next.custom) throw Error('No custom theme saved');
        return next;
    }
    function paint(value) {
        const root = document.documentElement;
        root.dataset.theme = value.theme;
        root.dataset.crtEffects = String(value.crtEffects);
        for (const name of schema.keys) root.style.removeProperty('--ui-'+name);
        for (const name of ['green','black','dark-green','spectrum-bg','spectrum-fg',...Array.from({length:31},(_,i)=>'tone-'+i)]) root.style.removeProperty('--'+name);
        if (value.theme !== 'custom') return;
        const c = value.custom.colors;
        for (const name of schema.keys) root.style.setProperty('--ui-'+name,c[name]);
        for (const [name,color] of Object.entries({green:c.accent,black:c.windowBackground,'dark-green':c.panel,'spectrum-bg':c.radioBackground,'spectrum-fg':c.radioAccent})) root.style.setProperty('--'+name,color);
        for(let i=0;i<31;i++) root.style.setProperty('--tone-'+i, [0,1,5,13,19,21,29].includes(i) ? c.windowBackground : `color-mix(in srgb, ${c.accent} 25%, transparent)`);
    }
    paint(state);
    window.ZombSettings = Object.freeze({
        themes, schema,
        get: () => copy(state),
        preview(patch) { paint(checked(patch)); },
        cancelPreview() { paint(state); },
        apply(patch) {
            try { state = checked(patch); } catch { return false; }
            paint(state); let persisted = true;
            try { localStorage.setItem(key,JSON.stringify(state)); } catch { persisted = false; }
            listeners.forEach(listener=>listener(copy(state))); return persisted;
        },
        reset() { return this.apply({theme:'toxic'}); },
        subscribe(listener) { listeners.add(listener); return ()=>listeners.delete(listener); }
    });
})();
