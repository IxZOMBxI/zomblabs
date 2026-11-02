import { mountThemeEditor } from './theme-editor.js';
const categories = [{ id: 'appearance', title: 'Custom Theme Editor', mount: mountThemeEditor }];
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
