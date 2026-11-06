import { mountThemeEditor } from './theme-editor.js';
function mountSounds(container, settings) {
    const heading = document.createElement('h2'); heading.textContent = 'UI Sounds';
    const enabled = document.createElement('input'); enabled.type = 'checkbox';
    const label = document.createElement('label'); label.append(enabled, ' Enable system sounds');
    const volume = document.createElement('input'); volume.type = 'range'; volume.min = '0'; volume.max = '1'; volume.step = '0.05';
    const volumeLabel = document.createElement('label'); volumeLabel.append('System sound volume ', volume);
    const result = document.createElement('p'); result.setAttribute('role', 'status');
    container.append(heading, label, document.createElement('br'), volumeLabel, result);
    const sync = state => { enabled.checked = state.systemSounds; volume.value = state.systemSoundVolume; };
    sync(settings.get());
    const save = () => { const saved = settings.apply({systemSounds:enabled.checked, systemSoundVolume:Number(volume.value)}); result.textContent = saved ? 'Sound preferences saved.' : 'Applied for this visit; storage unavailable.'; };
    enabled.onchange = save; volume.oninput = save;
    return settings.subscribe(sync);
}
const categories = [{ id: 'appearance', title: 'Custom Theme Editor', mount: mountThemeEditor }, { id: 'sounds', title: 'UI Sounds', mount: mountSounds }];
export function settingsApp(settings) {
    return { id: 'settings', title: 'Settings', width: 520, height: 560, minWidth: 300, minHeight: 280,
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
