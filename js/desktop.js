import { mountPwaChrome } from './pwa.js';
import { mountMobileShell } from './mobile-shell.js';
import { products } from './product-catalog.js';
import { BackpackState } from './backpack-state.js';
import { storeApp, productPages } from './store-app.js';
import { SystemSounds } from './system-sounds.js';
import { mountArcade } from './arcade.js';
import { ZombNetwork } from './zombnet-network.js';
import { ZombnetState } from './zombnet-state.js';
import { zombnetApp, createZombnetNavigation } from './zombnet-app.js';
import { filesystemContent } from './filesystem-content.js';
import { VirtualFilesystem } from './virtual-filesystem.js';
import { explorerApp } from './explorer-app.js';
import { settingsApp } from './settings-app.js';
import { AudioService } from './audio-service.js';
import { loadMediaCatalog } from './media-catalog.js';
import { radioApp } from './radio-app.js';
import { WindowManager } from './window-manager.js';
import { AppRegistry } from './app-registry.js';
import { PhoneService } from './phone-service.js';
import { phoneApp, mountPhoneNotice } from './phone-app.js';

const workspace = document.getElementById('windowWorkspace');
const taskbar = document.createElement('nav');
taskbar.id = 'zombTaskbar';
taskbar.setAttribute('aria-label', 'Running applications');
taskbar.hidden = workspace.hidden;
document.body.append(taskbar);
new MutationObserver(() => { taskbar.hidden = workspace.hidden; }).observe(workspace, { attributes: true, attributeFilter: ['hidden'] });
const startButton = document.createElement('button');
startButton.id = 'startButton';
startButton.textContent = '▣ START';
startButton.setAttribute('aria-expanded', 'false');
startButton.setAttribute('aria-controls', 'startMenu');
const runningApps = document.createElement('div');
runningApps.id = 'runningApps';
runningApps.setAttribute('aria-label', 'Running windows');
taskbar.append(startButton, runningApps);
const sounds = new SystemSounds();
sounds.configure(window.ZombSettings.get());
const unsubscribeSounds = window.ZombSettings.subscribe(state => sounds.configure(state));
const unbindSounds = sounds.bind(document);
const manager = new WindowManager(workspace, runningApps, name => sounds.play(name));
const apps = new AppRegistry(manager);
apps.register(settingsApp(window.ZombSettings));
apps.register({
    id: 'sample',
    title: 'Sample', width: 380, height: 300, minWidth: 280, minHeight: 220,
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


const audioService = new AudioService([]);
apps.register(radioApp(audioService));
const instances = new Map();
let phoneService;
function launch(id) {
    const existing = instances.get(id);
    if (manager.windows.has(existing)) manager.focus(existing, true);
    else instances.set(id, apps.open(id));
    phoneService?.event(`app.open:${id}`);
}
let networkStorage;
try { networkStorage = window.localStorage; } catch { /* In-memory browsing remains available. */ }
phoneService = new PhoneService({radio:audioService, storage:networkStorage, sounds});
apps.register(phoneApp(phoneService));
const removePhoneNotice = mountPhoneNotice(phoneService,launch);
let phoneBooted = false;
function syncPhoneActivity() {
    const active = !workspace.hidden && document.visibilityState === 'visible' && document.hasFocus();
    sounds.setActive(active);
    phoneService.setActive(active);
    if (active && !phoneBooted) { phoneBooted = true; phoneService.event('desktop.ready'); sounds.play('boot'); }
}
const phoneBootObserver = new MutationObserver(syncPhoneActivity);
phoneBootObserver.observe(workspace,{attributes:true,attributeFilter:['hidden']});
document.addEventListener('visibilitychange',syncPhoneActivity);
window.addEventListener('focus',syncPhoneActivity);
window.addEventListener('blur',syncPhoneActivity);
const phoneTimer = setInterval(() => { syncPhoneActivity(); phoneService.tick(); },500);
let radioPlaying = false, radioError = '', phoneError = '';
const unsubscribePhoneSounds = phoneService.subscribe(() => {
    if (phoneService.error && phoneService.error !== phoneError) sounds.play('error');
    phoneError = phoneService.error;
});
const unsubscribePhoneRadio = audioService.subscribe(() => {
    if (audioService.error && audioService.error !== radioError) sounds.play('error');
    radioError = audioService.error;
    const playing = !audioService.audio.paused;
    if (playing && !radioPlaying) phoneService.event('radio.play');
    radioPlaying = playing;
});
window.addEventListener('pagehide',event => {
    sounds.setActive(false);
    phoneService.setActive(false);
    if (event.persisted) return;
    clearInterval(phoneTimer); phoneBootObserver.disconnect(); removePhoneNotice(); unsubscribePhoneRadio();
    document.removeEventListener('visibilitychange',syncPhoneActivity);
    window.removeEventListener('focus',syncPhoneActivity); window.removeEventListener('blur',syncPhoneActivity);
    phoneService.dispose(); unsubscribePhoneSounds(); unsubscribeSounds(); unbindSounds(); sounds.dispose();
});
window.addEventListener('pageshow',syncPhoneActivity);
const network = new ZombNetwork();
network.addEventListener('discovery', () => sounds.play('discovery'));
const backpack = new BackpackState(products, networkStorage);
const networkNavigation = createZombnetNavigation();
for (const page of productPages(products, backpack, launch)) network.register(page);
apps.register(zombnetApp(network, new ZombnetState(networkStorage), launch, networkNavigation));
apps.register(storeApp(products, backpack, url => { launch('zombnet'); networkNavigation.open(url); }));
apps.register({ id: 'arcade', title: 'ZombNET Arcade', width: 700, height: 460, minWidth: 320, minHeight: 300, mount: mountArcade });
const installed = [
    { id: 'store', title: 'Zomb Store', symbol: '[▤]' },
    { id: 'social', title: 'Social Network', symbol: '[↗]' },
    { id: 'updates', title: 'System Update', symbol: '[✉]' },
    { id: 'radio', title: 'Radio', symbol: '[♫]' },
    { id: 'phone', title: 'Phone', symbol: '[☎]' },
    { id: 'settings', title: 'Settings', symbol: '[⚙]' },
    { id: 'explorer', title: 'File Explorer', symbol: '[▣]' },
    { id: 'zombnet', title: 'ZombNET', symbol: '[◎]' },
    { id: 'arcade', title: 'ZombNET Arcade', symbol: '[▶]' }
];
const disposePwaChrome = mountPwaChrome();
const disposeMobileShell = mountMobileShell({manager, installed, launch, workspace});
window.addEventListener('pagehide', event => { if (!event.persisted) { disposeMobileShell(); disposePwaChrome(); } });
const virtualFilesystem = new VirtualFilesystem(filesystemContent(installed, []));
virtualFilesystem.addEventListener('discovery', () => sounds.play('discovery'));
function previewFile(entry, properties) {
    const id = `file-view:${properties ? 'properties' : 'text'}:${entry.path}`;
    if (!apps.apps.has(id)) apps.register({
        id, title: properties ? `${entry.name} — Properties` : entry.name,
        width: 440, height: 340, minWidth: 280, minHeight: 220,
        mount(container) {
            if (!properties && entry.type === 'image') {
                const image = document.createElement('img'); image.className = 'file-image'; image.alt = entry.name;
                const message = document.createElement('p'); message.textContent = 'Loading image…';
                image.onload = () => { message.textContent = ''; };
                image.onerror = () => { image.hidden = true; message.textContent = 'Image unavailable or unsupported.'; };
                image.src = entry.src; container.append(image, message); return;
            }
            const text = document.createElement('pre'); text.className = 'file-preview';
            text.textContent = properties
                ? [`Name: ${entry.name}`, `Virtual path: ${entry.path}`, `Type: ${entry.type || 'Unknown'}`,
                    `Size: ${Number.isFinite(entry.size) ? entry.size + ' B' : 'Not supplied'}`,
                    `Modified: ${entry.modified || 'Not supplied'}`, `Hidden: ${Boolean(entry.hidden)}`, `System: ${Boolean(entry.system)}`,
                    entry.description || '', 'Read-only virtual item.'].join('\n')
                : entry.content || 'This document is empty.';
            container.append(text);
        }
    });
    launch(id);
}
apps.register(explorerApp(virtualFilesystem, launch, previewFile, window.ZombSettings, entry => {
    launch('radio');
    const index = audioService.catalog.findIndex(track => track.id === entry.trackId);
    if (index >= 0) {
        if (audioService.index !== index || !audioService.audio.src) audioService.select(index, true);
        else if (audioService.audio.paused) audioService.play();
    }
}));
function openRadio() { launch('radio'); }
const radioIndicator = document.createElement('button');
radioIndicator.id = 'radioIndicator';
radioIndicator.addEventListener('click', openRadio);
taskbar.append(radioIndicator);
audioService.subscribe(() => {
    radioIndicator.textContent = audioService.error ? 'RADIO: SIGNAL ERROR' : audioService.loading ? 'RADIO: LOADING' : audioService.audio.paused ? 'RADIO: STANDBY' : 'RADIO: PLAYING';
    radioIndicator.setAttribute('aria-label', `${radioIndicator.textContent}. Open Radio`);
});

// Catalog loading does not block boot or the desktop. Register the app immediately.
loadMediaCatalog().then(catalog => {
    const radioCatalog = catalog.filter(entry => entry.section !== 'calls');
    audioService.catalog = radioCatalog;
    virtualFilesystem.replace(filesystemContent(installed, radioCatalog));
    phoneService.setCatalog(catalog);
    audioService.emit();
}).catch(() => {
    audioService.error = 'Media library unavailable. Reload the page to retry.';
    phoneService.error = 'Call catalog unavailable. Reload the page to retry.'; phoneService.emit();
    audioService.emit();
});

// Move original nodes rather than cloning them: existing form listeners and state survive.
for (const [id, title, contentId] of [
    ['social', 'Social Network', 'socialContent'],
    ['updates', 'System Update', 'updateContent']
]) {
    const content = document.getElementById(contentId);
    apps.register({ id, title, width: 440, height: id === 'social' ? 420 : 460, minWidth: 300, minHeight: 280, mount(container) {
        container.append(content);
        return () => document.getElementById('appStorage').append(content);
    }});
}

for (const app of installed) {
    const icon = document.createElement('button');
    icon.className = 'desktop-icon';
    icon.dataset.app = app.id;
    const symbol = document.createElement('span');
    symbol.className = 'desktop-icon-symbol'; symbol.textContent = app.symbol;
    symbol.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = app.title;
    icon.append(symbol, label);
    icon.addEventListener('dblclick', () => launch(app.id));
    icon.addEventListener('click', event => {
        if (event.detail === 0 || event.pointerType === 'touch' || event.pointerType === 'pen') launch(app.id);
    });
    document.getElementById('desktopIcons').append(icon);
}
const menu = document.createElement('div');
menu.id = 'startMenu'; menu.hidden = true;
menu.setAttribute('aria-label', 'Installed applications');
document.body.append(menu);
function closeMenu(returnFocus = false) {
    menu.hidden = true; startButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) startButton.focus();
}
for (const app of [...installed, { id: 'sample', title: 'Sample' }]) {
    if (app.id === 'sample') {
        const heading = document.createElement('p'); heading.textContent = 'DEVELOPMENT / UTILITIES'; menu.append(heading);
    }
    const button = document.createElement('button'); button.textContent = app.title;
    button.dataset.app = app.id;
    button.addEventListener('click', () => { closeMenu(); launch(app.id); });
    menu.append(button);
}
startButton.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    startButton.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) menu.querySelector('button').focus();
});
document.addEventListener('pointerdown', event => {
    if (!menu.contains(event.target) && !startButton.contains(event.target)) closeMenu();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) { closeMenu(true); }
});
menu.addEventListener('keydown', event => {
    const buttons = [...menu.querySelectorAll('button')];
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const offset = event.key === 'ArrowDown' ? 1 : -1;
        buttons[(buttons.indexOf(document.activeElement) + offset + buttons.length) % buttons.length].focus();
    }
});
const status = document.createElement('div');
status.id = 'desktopStatus';
const online = document.createElement('span');
const connectionIndicator = document.createElement('span'); connectionIndicator.className = 'connection-indicator'; connectionIndicator.textContent = '●';
online.append(connectionIndicator, ' ONLINE');
const clock = document.createElement('time');
status.append(online, clock); taskbar.append(status);
function updateClock() {
    const now = new Date(); clock.dateTime = now.toISOString();
    clock.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    clock.title = now.toLocaleDateString();
}
updateClock(); setInterval(updateClock, 1000);
