import { parseAddress } from './zombnet-network.js';
// Small bridge for desktop apps; all navigation still uses the existing history path.
export function createZombnetNavigation() {
    let navigate;
    return { bind(handler) { navigate=handler; return ()=>{ if(navigate===handler) navigate=null; }; },
        open(url) { if (!navigate || parseAddress(url)?.kind !== 'internal') return false; navigate(url); return true; } };
}
export function zombnetApp(network, state, launch, navigation) {
    return { id: 'zombnet', title: 'ZombNET', width: 650, height: 480, minWidth: 320, minHeight: 300,
        mount(container) {
            container.classList.add('zombnet');
            container.innerHTML = `<div class="zombnet-brand">ZombNET / NETWORK NAVIGATOR</div>
                <div class="zombnet-toolbar"><button data-back>Back</button><button data-forward>Forward</button><button data-refresh>Refresh</button><button data-home>Home</button><button data-bookmarks>Bookmarks</button><button data-history>History</button></div>
                <form class="zombnet-address"><label>Address <input aria-label="ZombNET address" spellcheck="false"></label><button>Go</button></form>
                <strong data-title></strong><aside data-panel hidden></aside><article class="zombnet-page" tabindex="0" aria-label="Internal webpage"></article><div data-status role="status"></div>`;
            const get = selector => container.querySelector(selector);
            let pageCleanup;
            let current = 'zomb://home', stack = [current], cursor = 0, panel = null;
            const status = message => { get('[data-status]').textContent = message; };
            function external(url) {
                // Open synchronously during the gesture, detach opener before navigating.
                let tab;
                try {
                    tab = window.open('about:blank', '_blank');
                    if (tab) {
                        tab.opener = null;
                        const policy = tab.document.createElement('meta'); policy.name = 'referrer'; policy.content = 'no-referrer'; tab.document.head.append(policy);
                        tab.location.replace(url);
                    }
                } catch { tab?.close(); tab = null; }
                status(tab ? 'External HTTPS site opened in a separate browser tab.' : 'Popup blocked. Use the external link below to open a new tab.');
                const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = ` Open external site: ${url}`;
                get('[data-status]').append(link);
            }
            function navigate(value, record = true) {
                const parsed = parseAddress(value);
                if (!parsed) { status('Unsupported address. Use zomb:// for internal pages or https:// for external sites.'); return; }
                if (parsed.kind === 'external') { external(parsed.url); return; }
                current = parsed.url;
                if (record && stack[cursor] !== current) { stack = stack.slice(0, cursor + 1); stack.push(current); if (stack.length > 100) stack.shift(); cursor = stack.length - 1; }
                render();
            }
            function addLink(parent, label, url) {
                const parsed = parseAddress(url); if (!parsed) return;
                const link = document.createElement('a'); link.href = parsed.url; link.textContent = label + (parsed.kind === 'external' ? ' ↗ (external HTTPS)' : '');
                if (parsed.kind === 'external') { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
                link.onclick = event => { event.preventDefault(); navigate(parsed.url); }; parent.append(link);
            }
            function renderPanel() {
                const area = get('[data-panel]'); area.replaceChildren(); area.hidden = !panel;
                get('[data-bookmarks]').setAttribute('aria-expanded', String(panel === 'bookmarks'));
                get('[data-history]').setAttribute('aria-expanded', String(panel === 'history'));
                if (!panel) return;
                const heading = document.createElement('strong'); heading.textContent = panel === 'bookmarks' ? 'Bookmarks' : 'Browsing history'; area.append(heading);
                const action = document.createElement('button'); action.textContent = panel === 'bookmarks' ? 'Bookmark current page' : 'Clear history';
                action.disabled = panel === 'bookmarks' && !network.get(current);
                action.onclick = () => {
                    const saved = panel === 'bookmarks' ? state.bookmark(current, network.get(current).title) : state.clear();
                    if (panel === 'history') { stack = [current]; cursor = 0; updateButtons(); }
                    renderPanel(); status(saved ? 'Saved locally.' : 'Updated for this visit; browser storage is unavailable.');
                }; area.append(action);
                const entries = state[panel];
                if (!entries.length) { const empty = document.createElement('p'); empty.textContent = 'No entries.'; area.append(empty); }
                entries.forEach(entry => {
                    const row = document.createElement('div'); addLink(row, entry.title, entry.url);
                    if (panel === 'bookmarks') {
                        const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove bookmark ${entry.title}`);
                        remove.onclick = () => { const saved = state.remove(entry.url); renderPanel(); status(saved ? 'Bookmark removed.' : 'Removed for this visit; storage unavailable.'); }; row.append(remove);
                    }
                    area.append(row);
                });
            }
            function updateButtons() { get('[data-back]').disabled = cursor === 0; get('[data-forward]').disabled = cursor === stack.length - 1; }
            function render() {
                pageCleanup?.(); pageCleanup = null;
                status('Loading internal page…');
                const page = network.get(current), viewport = get('.zombnet-page'); viewport.replaceChildren();
                get('input').value = current; get('[data-title]').textContent = page?.title || '404 — Destination unavailable';
                viewport.dataset.site = page?.layout || 'error';
                const heading = document.createElement('h1'); heading.textContent = page?.heading || '404 — Destination unavailable';
                const text = document.createElement('p'); text.textContent = page?.description || `No accessible internal page exists at ${current}.`;
                viewport.append(heading, text);
                if (page?.directory) {
                    const list = document.createElement('ul');
                    network.directory().forEach(entry => { const item = document.createElement('li'); addLink(item, entry.title, entry.url); list.append(item); }); viewport.append(list);
                }
                for (const block of page?.blocks || []) {
                    if (block.type === 'link') addLink(viewport, block.label, block.url);
                    else if (block.type === 'action') { const button = document.createElement('button'); button.textContent = block.label; button.onclick = () => launch(block.appId); viewport.append(button); }
                    else if (block.type === 'text') { const paragraph = document.createElement('p'); paragraph.textContent = block.text; viewport.append(paragraph); }
                }
                if (page?.mount) { viewport.replaceChildren(); pageCleanup = page.mount(viewport); }
                viewport.scrollTop = 0;
                state.visit(current, page?.title || current); updateButtons(); renderPanel();
                status(page ? 'Ready · Fictional internal ZombNET page' : '404 · Unknown or unavailable internal destination');
            }
            get('form').onsubmit = event => { event.preventDefault(); navigate(get('input').value); };
            get('[data-back]').onclick = () => { if (cursor > 0) navigate(stack[--cursor], false); };
            get('[data-forward]').onclick = () => { if (cursor < stack.length - 1) navigate(stack[++cursor], false); };
            get('[data-refresh]').onclick = render;
            get('[data-home]').onclick = () => navigate('zomb://home');
            for (const name of ['bookmarks','history']) get(`[data-${name}]`).onclick = () => { panel = panel === name ? null : name; renderPanel(); };
            const changed = () => render(); network.addEventListener('change', changed);
            const unbind = navigation?.bind(navigate);
            render();
            return () => { unbind?.(); pageCleanup?.(); network.removeEventListener('change', changed); };
        }
    };
}
