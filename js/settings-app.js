// Categories own their controls; the shared service owns validation and persistence.
const categories = [{
    id: 'appearance', title: 'Appearance',
    mount(container, settings) {
        container.innerHTML = `<label>Theme <select data-theme-choice></select></label>
            <div class="theme-preview" aria-label="Interactive theme preview"><strong>ZombOS / Preview</strong><p>Signal online · Ready</p><button type="button">Test button</button></div>
            <div class="settings-actions"><button data-apply>Apply</button><button data-reset>Reset</button><button data-default>Restore Default</button></div>
            <p data-result role="status"></p>`;
        const choice = container.querySelector('select');
        const preview = container.querySelector('.theme-preview');
        const result = container.querySelector('[data-result]');
        for (const [id, title] of Object.entries(settings.themes)) choice.add(new Option(title, id));
        function sync() { choice.value = settings.get().theme; preview.dataset.theme = choice.value; }
        sync();
        choice.addEventListener('change', () => { preview.dataset.theme = choice.value; result.textContent = 'Preview only. Apply to use this theme.'; });
        container.querySelector('[data-apply]').onclick = () => {
            result.textContent = settings.apply({ theme: choice.value }) ? 'Appearance saved on this device.' : 'Applied for this visit. Browser storage is unavailable.';
        };
        container.querySelector('[data-reset]').onclick = () => { sync(); result.textContent = 'Unapplied changes reset.'; };
        container.querySelector('[data-default]').onclick = () => { const saved = settings.reset(); sync(); result.textContent = saved ? 'Default appearance restored.' : 'Default restored for this visit; storage unavailable.'; };
        preview.querySelector('button').onclick = event => { event.target.textContent = event.target.textContent === 'Test button' ? 'Signal received' : 'Test button'; };
        let appliedTheme = settings.get().theme;
        return settings.subscribe(state => {
            if (state.theme !== appliedTheme) { appliedTheme = state.theme; sync(); }
        });
    }
}];
export function settingsApp(settings) {
    return { id: 'settings', title: 'Settings', width: 420, height: 360, minWidth: 300, minHeight: 280,
        mount(container) {
            container.classList.add('settings-app');
            const navigation = document.createElement('nav'); navigation.setAttribute('aria-label', 'Settings categories');
            const panel = document.createElement('section');
            container.append(navigation, panel);
            let cleanup;
            for (const category of categories) {
                const button = document.createElement('button'); button.textContent = category.title;
                button.onclick = () => { cleanup?.(); panel.replaceChildren(); cleanup = category.mount(panel, settings); };
                navigation.append(button);
            }
            navigation.firstChild.click();
            return () => cleanup?.();
        }
    };
}
