import { parentPath } from './virtual-filesystem.js';
const typeLabel = { folder: 'Folder', music: 'Music shortcut', broadcast: 'Broadcast shortcut', text: 'Text document' };
export function explorerApp(filesystem, launch, preview) {
    // Extend this dispatch table when adding new supported virtual file types.
    const actions = { music: () => launch('radio'), broadcast: () => launch('radio'), text: entry => preview(entry, false) };
    return { id: 'explorer', title: 'File Explorer', width: 660, height: 460, minWidth: 320, minHeight: 300,
        mount(container) {
            container.classList.add('explorer');
            container.innerHTML = `<div class="explorer-menus"></div>
                <div class="explorer-toolbar"><button data-back>Back</button><button data-forward>Forward</button><button data-up>Up</button><button data-home>Home</button><button data-refresh>Refresh</button><button data-open>Open</button></div>
                <form class="explorer-address"><label>Address <input aria-label="Virtual directory" spellcheck="false"></label><button>Go</button></form>
                <div class="explorer-panes"><nav class="explorer-tree" aria-label="Virtual folders"></nav><div class="explorer-divider" role="separator" aria-label="Navigation pane width" aria-orientation="vertical" tabindex="0"></div><div class="explorer-content" tabindex="0" aria-label="Directory contents"></div></div>
                <div class="explorer-status" role="status"></div>`;
            const get = selector => container.querySelector(selector);
            let path = 'C:\\', history = [path], cursor = 0, selected = null, view = 'details', showHidden = false;
            const expanded = new Set(['C:\\']);
            const menus = get('.explorer-menus');
            function menu(name, options) {
                const details = document.createElement('details');
                const summary = document.createElement('summary'); summary.textContent = name; details.append(summary);
                const items = document.createElement('div');
                for (const [label, callback] of options) {
                    const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.disabled = !callback;
                    if (label === 'Open') button.dataset.explorerOpen = '';
                    button.onclick = () => { details.open = false; callback(); }; items.append(button);
                }
                details.append(items); menus.append(details);
                details.addEventListener('toggle', () => { if (details.open) for (const other of menus.children) if (other !== details) other.open = false; });
            }
            const properties = () => preview(selected || filesystem.resolve(path, showHidden) || { name: path, path, description: 'Directory not found or unavailable.' }, true);
            menu('File', [['Open', () => openSelected()], ['Properties', properties]]);
            menu('Edit', [['Delete (read-only)', null], ['Rename (read-only)', null], ['Move (read-only)', null]]);
            menu('View', [['List', () => { view = 'list'; render(); }], ['Details', () => { view = 'details'; render(); }], ['Toggle hidden items', () => { showHidden = !showHidden; render(); }], ['Refresh', () => render()]]);
            menu('Help', [['About File Explorer', () => preview({ path: 'explorer-help', name: 'About File Explorer', content: 'Read-only virtual C: drive. No files on your computer are accessed.\n\nDouble-click or select and Open/Enter. Backspace goes up; arrows select items. Use View for List/Details and hidden entries. Hidden entries are not private or protected.' }, false)]]);
            function status(items) { get('.explorer-status').textContent = `${items?.length || 0} items${showHidden ? ' · Hidden items shown' : ''}${selected ? ' · ' + selected.name + ' · ' + (typeLabel[selected.type] || 'Unknown file') : ''}`; }
            function navigate(next, record = true) {
                path = next; selected = null;
                if (record) { history = history.slice(0, cursor + 1); history.push(path); cursor++; }
                let parent = parentPath(path); while (parent) { expanded.add(parent); parent = parentPath(parent); }
                render();
            }
            function openSelected() {
                if (!selected) return;
                if (selected.type === 'folder') navigate(selected.path);
                else (actions[selected.type] || (entry => preview(entry, true)))(selected);
            }
            function renderTree() {
                const tree = get('.explorer-tree'); tree.replaceChildren();
                function branch(entry, depth) {
                    const row = document.createElement('div'); row.style.paddingLeft = `${depth * 12}px`;
                    const children = (filesystem.list(entry.path, showHidden) || []).filter(e => e.type === 'folder');
                    const toggle = document.createElement('button'); toggle.textContent = expanded.has(entry.path) ? '−' : '+'; toggle.disabled = !children.length;
                    toggle.setAttribute('aria-label', `Expand or collapse ${entry.name}`); toggle.setAttribute('aria-expanded', String(expanded.has(entry.path)));
                    toggle.onclick = () => { expanded.has(entry.path) ? expanded.delete(entry.path) : expanded.add(entry.path); renderTree(); };
                    const button = document.createElement('button'); button.textContent = '▣ ' + entry.name; button.onclick = () => navigate(entry.path); button.setAttribute('aria-current', String(entry.path === path));
                    row.append(toggle, button); tree.append(row);
                    if (expanded.has(entry.path)) children.forEach(child => branch(child, depth + 1));
                }
                const root = filesystem.resolve('C:\\', showHidden); if (root) branch(root, 0);
            }
            function render() {
                const entry = filesystem.resolve(path, showHidden); if (entry) path = entry.path;
                const items = filesystem.list(path, showHidden);
                selected = items?.find(item => item.path === selected?.path) || null;
                get('input').value = path;
                get('[data-back]').disabled = cursor === 0; get('[data-forward]').disabled = cursor === history.length - 1;
                get('[data-up]').disabled = !parentPath(path); container.querySelectorAll('[data-open], [data-explorer-open]').forEach(button => { button.disabled = !selected; });
                renderTree();
                const pane = get('.explorer-content'); pane.replaceChildren(); pane.dataset.view = view;
                if (!items || !items.length) {
                    const message = document.createElement('p'); message.textContent = items ? 'This folder is empty.' : 'Directory not found or unavailable. Use Home or enter a valid virtual path.'; pane.append(message);
                } else {
                    const table = document.createElement('table');
                    if (view === 'details') { const head = table.createTHead().insertRow(); for (const title of ['Name', 'Type', 'Size', 'Modified']) { const th = document.createElement('th'); th.textContent = title; head.append(th); } }
                    const body = table.createTBody();
                    for (const item of items) {
                        const row = body.insertRow(); row.tabIndex = 0; row.dataset.path = item.path; row.setAttribute('aria-selected', String(selected?.path === item.path));
                        const name = row.insertCell(); name.textContent = `${item.type === 'folder' ? '▣' : item.type === 'music' || item.type === 'broadcast' ? '♫' : '▤'} ${item.name}`;
                        if (view === 'details') for (const value of [typeLabel[item.type] || 'Unknown file', Number.isFinite(item.size) ? `${item.size} B` : '—', item.modified || '—']) row.insertCell().textContent = value;
                        function select() { selected = item; body.querySelectorAll('tr').forEach(r => r.setAttribute('aria-selected', String(r === row))); container.querySelectorAll('[data-open], [data-explorer-open]').forEach(button => { button.disabled = false; }); status(items); }
                        row.onclick = select; row.onfocus = select; row.ondblclick = () => { select(); openSelected(); };
                        row.onkeydown = event => {
                            const rows = [...body.rows], index = rows.indexOf(row);
                            if (event.key === 'Enter') { event.preventDefault(); select(); openSelected(); }
                            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                                event.preventDefault(); const delta = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
                                rows[event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + delta))].focus();
                            }
                        };
                    }
                    pane.append(table);
                }
                status(items);
            }
            get('[data-back]').onclick = () => { if (cursor > 0) navigate(history[--cursor], false); };
            get('[data-forward]').onclick = () => { if (cursor < history.length - 1) navigate(history[++cursor], false); };
            get('[data-up]').onclick = () => { const parent = parentPath(path); if (parent) navigate(parent); };
            get('[data-home]').onclick = () => navigate('C:\\');
            get('[data-refresh]').onclick = () => render();
            get('[data-open]').onclick = openSelected;
            get('form').onsubmit = event => { event.preventDefault(); navigate(get('input').value); };
            container.addEventListener('keydown', event => {
                if (event.key === 'Escape') menus.querySelectorAll('details').forEach(d => d.open = false);
                if (event.key === 'Backspace' && event.target.tagName !== 'INPUT') { event.preventDefault(); get('[data-up]').click(); }
            });
            const divider = get('.explorer-divider'), panes = get('.explorer-panes');
            const resize = width => { const actual = Math.max(60, Math.min(width, panes.clientWidth - 120)); panes.style.setProperty('--tree-width', `${actual}px`); divider.setAttribute('aria-valuenow', String(Math.round(actual))); };
            divider.onpointerdown = event => { if (event.button === 0) { divider.setPointerCapture(event.pointerId); event.preventDefault(); } };
            divider.onpointermove = event => { if (divider.hasPointerCapture(event.pointerId)) resize(event.clientX - panes.getBoundingClientRect().left); };
            divider.onpointerup = event => { if (divider.hasPointerCapture(event.pointerId)) divider.releasePointerCapture(event.pointerId); };
            divider.onkeydown = event => { if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); resize(get('.explorer-tree').clientWidth + (event.key === 'ArrowLeft' ? -10 : 10)); } };
            const observer = new ResizeObserver(() => resize(get('.explorer-tree').clientWidth)); observer.observe(panes);
            const changed = () => render(); filesystem.addEventListener('change', changed);
            render();
            return () => { observer.disconnect(); filesystem.removeEventListener('change', changed); };
        }
    };
}
