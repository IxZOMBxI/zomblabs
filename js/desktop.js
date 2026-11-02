import { AudioService } from './audio-service.js';
import { loadMediaCatalog } from './media-catalog.js';
import { radioApp } from './radio-app.js';
import { WindowManager } from './window-manager.js';
import { AppRegistry } from './app-registry.js';

const workspace = document.getElementById('windowWorkspace');
const taskbar = document.createElement('nav');
taskbar.id = 'zombTaskbar';
taskbar.setAttribute('aria-label', 'Running applications');
taskbar.hidden = workspace.hidden;
document.body.append(taskbar);
new MutationObserver(() => { taskbar.hidden = workspace.hidden; }).observe(workspace, { attributes: true, attributeFilter: ['hidden'] });
const manager = new WindowManager(workspace, taskbar);
const apps = new AppRegistry(manager);
apps.register({
    id: 'sample',
    title: 'SAMPLE.exe',
    mount(container) {
        const text = document.createElement('p');
        text.textContent = 'WINDOW SYSTEM ONLINE. Drag this title bar or focus it and use arrow keys. Open another sample to test overlapping windows.';
        const label = document.createElement('label');
        label.textContent = 'Temporary session note: ';
        const input = document.createElement('input');
        input.type = 'text';
        label.append(input);
        container.append(text, label);
        // Future apps may return a cleanup function. Shared services belong outside window content.
    }
});
document.getElementById('openSample').addEventListener('click', () => apps.open('sample'));

const audioService = new AudioService([]);
apps.register(radioApp(audioService));
let radioWindow;
function openRadio() {
    if (manager.windows.has(radioWindow)) manager.focus(radioWindow, true);
    else radioWindow = apps.open('radio');
}
const radioIndicator = document.createElement('button');
radioIndicator.id = 'radioIndicator';
radioIndicator.addEventListener('click', openRadio);
taskbar.prepend(radioIndicator);
audioService.subscribe(() => {
    radioIndicator.textContent = audioService.error ? 'RADIO: SIGNAL ERROR' : audioService.loading ? 'RADIO: LOADING' : audioService.audio.paused ? 'RADIO: STANDBY' : 'RADIO: PLAYING';
    radioIndicator.setAttribute('aria-label', `${radioIndicator.textContent}. Open RADIO.exe`);
});

// Catalog loading does not block boot or the desktop. Register the app immediately.
loadMediaCatalog().then(catalog => {
    audioService.catalog = catalog;
    audioService.emit();
}).catch(() => {
    audioService.error = 'Media library unavailable. Reload the page to retry.';
    audioService.emit();
});
